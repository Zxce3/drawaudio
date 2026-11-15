import {
  DEFAULT_EFFECTS,
  DEFAULT_SOUND,
  GRID_SIZES,
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
  const size = matrix.length;
  const bytes = new Uint8Array(Math.ceil((size * size) / 8));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r]?.[c]) {
        const bit = r * size + c;
        bytes[bit >> 3] |= 1 << (bit & 7);
      }
    }
  }
  return bytesToBase64(bytes);
}

export function unpackMatrix(packed: string, size: number): boolean[][] {
  const matrix = emptyMatrix(size);
  const bytes = base64ToBytes(packed);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const bit = r * size + c;
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

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Turn untrusted data (URL, localStorage, file) into a valid Song */
export function sanitizeSong(raw: unknown): Song {
  const base = createSong();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, any>;

  const gridSize = GRID_SIZES.includes(r.gridSize) ? (r.gridSize as number) : base.gridSize;
  const rawTracks: unknown[] = Array.isArray(r.tracks) ? r.tracks.slice(0, MAX_TRACKS) : [];
  const tracks: Track[] = rawTracks.map((item, i) => {
    const t = (item ?? {}) as Record<string, any>;
    const p = (t.params ?? {}) as Record<string, any>;
    const d = DEFAULT_SOUND;
    return {
      id: newId(),
      name: typeof t.name === 'string' ? t.name.slice(0, 40) : `Synth ${i + 1}`,
      matrix:
        typeof t.matrix === 'string'
          ? unpackMatrix(t.matrix, gridSize)
          : emptyMatrix(gridSize),
      params: {
        waveform: pick(p.waveform, ['sine', 'sawtooth', 'triangle', 'square', 'pulse'] as const, d.waveform),
        pulseWidth: num(p.pulseWidth, d.pulseWidth, 0.05, 0.95),
        attack: num(p.attack, d.attack, 0, 2),
        decay: num(p.decay, d.decay, 0, 2),
        sustain: num(p.sustain, d.sustain, 0, 1),
        release: num(p.release, d.release, 0, 4),
        cutoff: num(p.cutoff, d.cutoff, 100, 20000),
        resonance: num(p.resonance, d.resonance, 0, 20),
        subLevel: num(p.subLevel, d.subLevel, 0, 1),
        noiseLevel: num(p.noiseLevel, d.noiseLevel, 0, 1),
        unison: Math.round(num(p.unison, d.unison, 1, 8)),
        detune: num(p.detune, d.detune, 0, 100),
        fmAmount: num(p.fmAmount, d.fmAmount, 0, 1),
        gate: num(p.gate, d.gate, 0.1, 1)
      },
      volume: num(t.volume, 0.8, 0, 1),
      pan: num(t.pan, 0, -1, 1),
      reverbSend: num(t.reverbSend, 0.3, 0, 1),
      mute: t.mute === true,
      solo: t.solo === true
    };
  });
  if (!tracks.length) return { ...base, gridSize, tracks: [{ ...base.tracks[0], matrix: emptyMatrix(gridSize) }] };

  const e = (r.effects ?? {}) as Record<string, any>;
  const de = DEFAULT_EFFECTS;
  return {
    name: typeof r.name === 'string' ? r.name.slice(0, 60) : base.name,
    tempo: Math.round(num(r.tempo, base.tempo, 30, 240)),
    gridSize,
    beatsPerBar: Math.round(num(r.beatsPerBar, 4, 2, 7)),
    scale: typeof r.scale === 'string' && r.scale in SCALES ? r.scale : base.scale,
    pattern: pick(r.pattern, ['forward', 'backward', 'bounce', 'random'] as const, 'forward'),
    effects: {
      delayTime: num(e.delayTime, de.delayTime, 0.01, 1),
      delayFeedback: num(e.delayFeedback, de.delayFeedback, 0, 0.9),
      delayMix: num(e.delayMix, de.delayMix, 0, 1),
      reverbMix: num(e.reverbMix, de.reverbMix, 0, 1),
      impulse: pick(e.impulse, ['reverb', 'guitar', 'drum'] as const, de.impulse),
      distortion: num(e.distortion, de.distortion, 0, 50),
      chorus: num(e.chorus, de.chorus, 0, 1),
      eqLow: num(e.eqLow, 0, -12, 12),
      eqMid: num(e.eqMid, 0, -12, 12),
      eqHigh: num(e.eqHigh, 0, -12, 12)
    },
    tracks,
    activeTrack: Math.min(Math.max(0, Math.round(num(r.activeTrack, 0, 0, tracks.length - 1))), tracks.length - 1)
  };
}

export function toCompact(song: Song): unknown {
  return { ...song, tracks: song.tracks.map((t) => ({ ...t, matrix: packMatrix(t.matrix) })) };
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
  writer.write(bytes as Uint8Array<ArrayBuffer>);
  writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

export async function encodeShare(song: Song): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toCompact(song)));
  return bytesToBase64(await transform(json, new CompressionStream('deflate-raw')));
}

export async function decodeShare(text: string): Promise<Song> {
  const bytes = await transform(base64ToBytes(text), new DecompressionStream('deflate-raw'));
  return sanitizeSong(JSON.parse(new TextDecoder().decode(bytes)));
}
