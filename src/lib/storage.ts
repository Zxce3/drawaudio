import {
  DEFAULT_EFFECTS,
  DEFAULT_SOUND,
  GRID_SIZES,
  STEP_OPTIONS,
  PARAM_CHOICES,
  cleanTies,
  PARAM_RANGES,
  createSong,
  emptyMatrix,
  newId,
  type Song,
  type Track
} from './types';
import { SCALES } from './scales';

const STORAGE_KEY = 'drawaudio:songs';
const MAX_TRACKS = 8;

// ---------------------------------------------------------- matrix packing

export function packMatrix(matrix: boolean[][]): string {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const bytes = new Uint8Array(Math.ceil((rows * cols) / 8));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (matrix[r]?.[c]) {
        const bit = r * cols + c;
        bytes[bit >> 3] |= 1 << (bit & 7);
      }
    }
  }
  return bytesToBase64(bytes);
}

export function unpackMatrix(packed: string, rows: number, cols = rows): boolean[][] {
  const matrix = emptyMatrix(rows, cols);
  const bytes = base64ToBytes(packed);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bit = r * cols + c;
      matrix[r][c] = ((bytes[bit >> 3] ?? 0) >> (bit & 7)) % 2 === 1;
    }
  }
  return matrix;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64ToBytes(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// --------------------------------------------------------------- sanitizing

const num = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/** Validate an untrusted settings object against a defaults object */
function mergeSettings<T extends object>(defaults: T, raw: Record<string, any>): T {
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(defaults)) {
    const value = raw[key];
    if (typeof def === 'number') {
      const [min, max] = PARAM_RANGES[key] ?? [-Infinity, Infinity];
      out[key] = num(value, def, min, max);
      if (Number.isInteger(def) && ['unison', 'noteLength', 'ratchet', 'arpNotes', 'arpOctaves', 'chordInversion'].includes(key)) {
        out[key] = Math.round(out[key] as number);
      }
    } else if (typeof def === 'boolean') {
      out[key] = typeof value === 'boolean' ? value : def;
    } else {
      const choices = PARAM_CHOICES[key];
      out[key] = choices?.includes(value) ? value : def;
    }
  }
  return out as T;
}

/** Songs saved before effect toggles existed: keep non-zero effects switched on */
function effectsWithLegacy(e: Record<string, any>): Record<string, any> {
  const next = { ...e };
  if (e.distortionEnabled === undefined && typeof e.distortion === 'number') next.distortionEnabled = e.distortion > 0;
  if (e.chorusEnabled === undefined && typeof e.chorus === 'number') next.chorusEnabled = e.chorus > 0;
  return next;
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Turn untrusted data (URL, localStorage, file) into a valid Song */
export function sanitizeSong(raw: unknown): Song {
  const base = createSong();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, any>;

  const gridSize = GRID_SIZES.includes(r.gridSize) ? (r.gridSize as number) : base.gridSize;
  // Songs from before song length existed are as many steps long as they have rows
  const steps = (STEP_OPTIONS as readonly number[]).includes(r.steps) ? (r.steps as number) : gridSize;
  const rawTracks: unknown[] = Array.isArray(r.tracks) ? r.tracks.slice(0, MAX_TRACKS) : [];
  const tracks: Track[] = rawTracks.map((item, i) => {
    const t = (item ?? {}) as Record<string, any>;
    const p = (t.params ?? {}) as Record<string, any>;
    const matrix = typeof t.matrix === 'string' ? unpackMatrix(t.matrix, gridSize, steps) : emptyMatrix(gridSize, steps);
    return {
      id: newId(),
      name: typeof t.name === 'string' ? t.name.slice(0, 40) : `Synth ${i + 1}`,
      matrix,
      ties: cleanTies(matrix, typeof t.ties === 'string' ? unpackMatrix(t.ties, gridSize, steps) : emptyMatrix(gridSize, steps)),
      params: mergeSettings(DEFAULT_SOUND, p),
      volume: num(t.volume, 0.8, 0, 1),
      pan: num(t.pan, 0, -1, 1),
      reverbSend: num(t.reverbSend, 0.3, 0, 1),
      mute: t.mute === true,
      solo: t.solo === true
    };
  });
  if (!tracks.length) return { ...base, gridSize, steps, tracks: [{ ...base.tracks[0], matrix: emptyMatrix(gridSize, steps), ties: emptyMatrix(gridSize, steps) }] };

  const e = (r.effects ?? {}) as Record<string, any>;
  return {
    name: typeof r.name === 'string' ? r.name.slice(0, 60) : base.name,
    tempo: Math.round(num(r.tempo, base.tempo, 30, 240)),
    gridSize,
    steps,
    beatsPerBar: Math.round(num(r.beatsPerBar, 4, 2, 7)),
    scale: typeof r.scale === 'string' && r.scale in SCALES ? r.scale : base.scale,
    pattern: pick(r.pattern, ['forward', 'backward', 'bounce', 'columns', 'random'] as const, 'forward'),
    swing: num(r.swing, 0.5, 0.25, 0.75),
    humanizeTiming: num(r.humanizeTiming, 0, 0, 1),
    humanizeVelocity: num(r.humanizeVelocity, 0, 0, 1),
    effects: mergeSettings(DEFAULT_EFFECTS, effectsWithLegacy(e)),
    tracks,
    activeTrack: Math.min(Math.max(0, Math.round(num(r.activeTrack, 0, 0, tracks.length - 1))), tracks.length - 1)
  };
}

export function toCompact(song: Song): unknown {
  // `ties` is only stored when a track has held notes, which keeps old songs and share links unchanged
  return {
    ...song,
    tracks: song.tracks.map((t) => {
      const { ties, ...rest } = t;
      return { ...rest, matrix: packMatrix(t.matrix), ...(ties?.some((row) => row.some(Boolean)) ? { ties: packMatrix(ties) } : {}) };
    })
  };
}

// -------------------------------------------------------------- local songs

export interface SavedSong {
  id: string;
  name: string;
  updatedAt: number;
  data: unknown;
}

export function listSongs(): SavedSong[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

export function saveSong(song: Song, id?: string): string {
  const songs = listSongs();
  const savedId = id ?? newId();
  const entry: SavedSong = { id: savedId, name: song.name, updatedAt: Date.now(), data: toCompact(song) };
  const next = [entry, ...songs.filter((s) => s.id !== savedId)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return savedId;
}

export function deleteSong(id: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(listSongs().filter((s) => s.id !== id)));
}

// ------------------------------------------------------------------ sharing

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const writer = stream.writable.getWriter();
  const written = writer.write(bytes as Uint8Array<ArrayBuffer>).then(() => writer.close());
  // Both sides can fail on damaged input (for example a truncated link): wait for both and surface one error
  const [, out] = await Promise.all([written, new Response(stream.readable).arrayBuffer()]);
  return new Uint8Array(out);
}

export async function encodeShare(song: Song): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toCompact(song)));
  return bytesToBase64(await transform(json, new CompressionStream('deflate-raw')));
}

export async function decodeShare(text: string): Promise<Song> {
  const bytes = await transform(base64ToBytes(text), new DecompressionStream('deflate-raw'));
  return sanitizeSong(JSON.parse(new TextDecoder().decode(bytes)));
}
