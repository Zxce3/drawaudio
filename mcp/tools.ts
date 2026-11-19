// Pure helpers behind the MCP tools. No MCP or DOM code here, so they can be tested with `bun test`.
import { formatNote, getRowPitch, SCALES } from '../src/lib/scales';
import { exportMidi, midiToSong, parseMidi } from '../src/lib/midi';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { sanitizeSong, toCompact } from '../src/lib/storage';
import { build, EXAMPLE_SONGS, type SongSpec } from '../src/lib/songs';
import {
  DEFAULT_EFFECTS, DEFAULT_SOUND, GRID_SIZES, PARAM_CHOICES, PARAM_RANGES, SOUND_PRESETS, createSong, type Song
} from '../src/lib/types';

export const APP_URL = 'https://drawaudio.zxce3.net/';
const BAR = 16;

// Same format as encodeShare/decodeShare in src/lib/storage.ts (deflate-raw + base64url), using node:zlib because
// CompressionStream is missing in some Bun versions.
const toB64Url = (b: Uint8Array) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64Url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
export const encodeShare = (song: Song) => toB64Url(deflateRawSync(Buffer.from(JSON.stringify(toCompact(song)))));
export const decodeShare = (hash: string) => sanitizeSong(JSON.parse(inflateRawSync(fromB64Url(hash)).toString('utf8')));

export const shareLink = async (song: Song) => `${APP_URL}#s=${encodeShare(song)}`;

/** Accept a compact song object, a share link or a bare share hash */
export async function loadSong(input: { song?: unknown; share_link?: string }): Promise<Song> {
  if (input.share_link) {
    const hash = input.share_link.includes('#s=') ? input.share_link.split('#s=')[1] : input.share_link;
    return decodeShare(hash.trim());
  }
  if (input.song) return sanitizeSong(input.song);
  throw new Error('Pass either `song` (compact JSON from another tool) or `share_link`.');
}

/** Song as note-name step strings, one per 16-step bar, in the same format `create_song` accepts */
export function songToSteps(song: Song) {
  return song.tracks.map((track) => {
    const bars: string[] = [];
    for (let start = 0; start < song.gridSize; start += BAR) {
      const tokens: string[] = [];
      for (let col = start; col < Math.min(start + BAR, song.gridSize); col++) {
        const notes: string[] = [];
        for (let row = song.gridSize - 1; row >= 0; row--) {
          if (track.matrix[row]?.[col]) notes.push(formatNote(getRowPitch(song.scale, song.gridSize, row)));
        }
        tokens.push(notes.length ? notes.join(',') : '.');
      }
      bars.push(tokens.join(' '));
    }
    return { name: track.name, steps: bars };
  });
}

export function describeSong(song: Song) {
  const beatsPerLoop = (song.gridSize / 4);
  return {
    name: song.name,
    tempo: song.tempo,
    scale: song.scale,
    gridSize: song.gridSize,
    bars: song.gridSize / BAR,
    loopSeconds: Math.round((60 / song.tempo) * beatsPerLoop * 10) / 10,
    swing: song.swing,
    pattern: song.pattern,
    effectsEnabled: Object.entries(song.effects).filter(([k, v]) => k.endsWith('Enabled') && v).map(([k]) => k.replace('Enabled', '')),
    tracks: song.tracks.map((t, i) => ({
      index: i,
      name: t.name,
      notes: t.matrix.flat().filter(Boolean).length,
      volume: t.volume,
      pan: t.pan,
      reverbSend: t.reverbSend,
      waveform: t.params.waveform,
      mute: t.mute,
      solo: t.solo
    })),
    steps: songToSteps(song)
  };
}

export interface TrackInput {
  name: string;
  steps: string | string[];
  sound?: string;
  sound_overrides?: Record<string, unknown>;
  volume?: number;
  pan?: number;
  reverb?: number;
}

export interface CreateInput {
  name: string;
  tempo?: number;
  scale?: string;
  size?: 16 | 32 | 64;
  swing?: number;
  effects?: Record<string, unknown>;
  tracks: TrackInput[];
}

export function createSongFromSpec(input: CreateInput): Song {
  if (input.scale && !(input.scale in SCALES)) throw new Error(`Unknown scale "${input.scale}". Use list_scales.`);
  for (const t of input.tracks) {
    if (t.sound && !(t.sound in SOUND_PRESETS)) throw new Error(`Unknown preset "${t.sound}". Use list_presets.`);
  }
  const spec: SongSpec = {
    name: input.name,
    description: '',
    size: input.size ?? 16,
    tempo: input.tempo ?? 90,
    scale: input.scale ?? 'Pentatonic',
    swing: input.swing,
    effects: input.effects as SongSpec['effects'],
    tracks: input.tracks.slice(0, 8).map((t) => ({
      name: t.name,
      steps: t.steps,
      sound: t.sound ? [t.sound, (t.sound_overrides ?? {}) as never] : t.sound_overrides ? ['Clean', t.sound_overrides as never] : undefined,
      volume: t.volume,
      pan: t.pan,
      reverb: t.reverb
    }))
  };
  // build() throws on a bar longer than 16 steps; sanitizing clamps every number and enum
  return sanitizeSong(toCompact(build(spec)));
}

export interface EditInput {
  name?: string;
  tempo?: number;
  scale?: string;
  swing?: number;
  humanizeTiming?: number;
  humanizeVelocity?: number;
  pattern?: string;
  effects?: Record<string, unknown>;
  tracks?: { index: number; name?: string; volume?: number; pan?: number; reverbSend?: number; mute?: boolean; solo?: boolean; sound?: Record<string, unknown> }[];
}

export function editSong(song: Song, patch: EditInput): Song {
  const compact = structuredClone(toCompact(song)) as Record<string, any>;
  for (const key of ['name', 'tempo', 'scale', 'swing', 'humanizeTiming', 'humanizeVelocity', 'pattern'] as const) {
    if (patch[key] !== undefined) compact[key] = patch[key];
  }
  if (patch.effects) compact.effects = { ...compact.effects, ...patch.effects };
  for (const t of patch.tracks ?? []) {
    const track = compact.tracks[t.index];
    if (!track) throw new Error(`No track with index ${t.index}`);
    for (const key of ['name', 'volume', 'pan', 'reverbSend', 'mute', 'solo'] as const) {
      if (t[key] !== undefined) track[key] = t[key];
    }
    if (t.sound) track.params = { ...track.params, ...t.sound };
  }
  return sanitizeSong(compact);
}

export function paramSchema() {
  const describe = (defaults: object) =>
    Object.fromEntries(
      Object.entries(defaults).map(([key, def]) => [
        key,
        typeof def === 'number'
          ? { type: 'number', default: def, range: PARAM_RANGES[key] }
          : typeof def === 'boolean'
            ? { type: 'boolean', default: def }
            : { type: 'choice', default: def, choices: PARAM_CHOICES[key] }
      ])
    );
  return {
    song: { gridSizes: GRID_SIZES, tempo: [30, 240], beatsPerBar: [2, 7], swing: [0.25, 0.75], maxTracks: 8, patterns: ['forward', 'backward', 'bounce', 'columns', 'random'] },
    trackSound: describe(DEFAULT_SOUND),
    effects: describe(DEFAULT_EFFECTS),
    trackMixer: { volume: [0, 1], pan: [-1, 1], reverbSend: [0, 1] }
  };
}

export const listExamples = () => EXAMPLE_SONGS.map((e) => ({ id: e.id, name: e.name, gridSize: e.size, description: e.description }));
export const getExample = (id: string) => {
  const example = EXAMPLE_SONGS.find((e) => e.id === id);
  if (!example) throw new Error(`Unknown example "${id}". Use list_examples.`);
  return sanitizeSong(toCompact(example.create()));
};
export const listScales = () => Object.entries(SCALES).map(([name, notes]) => ({ name, notesFromC: notes.map((n) => n.replace('s', '#')) }));
export const listPresets = () => Object.entries(SOUND_PRESETS).map(([name, params]) => ({ name, params }));

export const midiBytes = (song: Song) => exportMidi(song);
export function songFromMidi(bytes: Uint8Array, fileName: string, scale = 'Chromatic'): Song {
  const base = { ...createSong(), scale: scale in SCALES ? scale : 'Chromatic' };
  return sanitizeSong(toCompact(midiToSong(parseMidi(bytes), base, fileName)));
}
export { toCompact };
