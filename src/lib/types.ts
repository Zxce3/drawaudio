export type Waveform = 'sine' | 'sawtooth' | 'triangle' | 'square' | 'pulse';
export type PlaybackPattern = 'forward' | 'backward' | 'bounce' | 'random';
export type ImpulseType = 'reverb' | 'guitar' | 'drum';

export const GRID_SIZES = [8, 16, 32, 64] as const;
export const TIME_SIGNATURES = [2, 3, 4, 5, 6, 7] as const; // beats per bar, x/4

/** Per-track synth voice settings */
export interface SoundParams {
  waveform: Waveform;
  pulseWidth: number; // 0.05 - 0.95 (pulse only)
  attack: number; // seconds
  decay: number;
  sustain: number; // 0 - 1
  release: number;
  cutoff: number; // Hz
  resonance: number; // Q
  subLevel: number; // 0 - 1
  noiseLevel: number; // 0 - 1
  unison: number; // 1 - 8 voices
  detune: number; // cents spread
  fmAmount: number; // 0 - 1
  gate: number; // 0.1 - 1 fraction of a step the note is held
}

export interface Track {
  id: string;
  name: string;
  matrix: boolean[][]; // [row][col], row 0 = highest pitch
  params: SoundParams;
  volume: number; // 0 - 1
  pan: number; // -1 - 1
  reverbSend: number; // 0 - 1
  mute: boolean;
  solo: boolean;
}

export interface Effects {
  delayTime: number; // seconds
  delayFeedback: number; // 0 - 0.9
  delayMix: number; // 0 - 1
  reverbMix: number; // 0 - 1
  impulse: ImpulseType;
  distortion: number; // 0 - 50
  chorus: number; // 0 - 1
  eqLow: number; // dB
  eqMid: number;
  eqHigh: number;
}

export interface Song {
  name: string;
  tempo: number;
  gridSize: number;
  beatsPerBar: number;
  scale: string;
  pattern: PlaybackPattern;
  effects: Effects;
  tracks: Track[];
  activeTrack: number;
}

export const DEFAULT_SOUND: SoundParams = {
  waveform: 'sine',
  pulseWidth: 0.5,
  attack: 0.01,
  decay: 0.1,
  sustain: 0.6,
  release: 0.25,
  cutoff: 6000,
  resonance: 0.7,
  subLevel: 0,
  noiseLevel: 0,
  unison: 1,
  detune: 10,
  fmAmount: 0,
  gate: 0.9
};

export const DEFAULT_EFFECTS: Effects = {
  delayTime: 0.3,
  delayFeedback: 0.3,
  delayMix: 0.3,
  reverbMix: 0.3,
  impulse: 'reverb',
  distortion: 0,
  chorus: 0,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0
};

export function emptyMatrix(size: number): boolean[][] {
  return Array.from({ length: size }, () => Array<boolean>(size).fill(false));
}

let idCounter = 0;
export function newId(): string {
  idCounter += 1;
  return `t${Date.now().toString(36)}${idCounter}`;
}

export function createTrack(size: number, name: string, params: Partial<SoundParams> = {}): Track {
  return {
    id: newId(),
    name,
    matrix: emptyMatrix(size),
    params: { ...DEFAULT_SOUND, ...params },
    volume: 0.8,
    pan: 0,
    reverbSend: 0.3,
    mute: false,
    solo: false
  };
}

export function createSong(): Song {
  return {
    name: 'Untitled',
    tempo: 80,
    gridSize: 16,
    beatsPerBar: 4,
    scale: 'Pentatonic',
    pattern: 'forward',
    effects: { ...DEFAULT_EFFECTS },
    tracks: [createTrack(16, 'Synth 1')],
    activeTrack: 0
  };
}

export const SOUND_PRESETS: Record<string, Partial<SoundParams>> = {
  Clean: {},
  Pluck: { waveform: 'triangle', attack: 0.005, decay: 0.18, sustain: 0.1, release: 0.2, cutoff: 4000, gate: 0.5 },
  Pad: { waveform: 'sawtooth', attack: 0.3, decay: 0.3, sustain: 0.8, release: 0.8, cutoff: 1800, unison: 4, detune: 18, gate: 1 },
  Bass: { waveform: 'sawtooth', attack: 0.005, decay: 0.15, sustain: 0.7, release: 0.1, cutoff: 700, resonance: 4, subLevel: 0.6, gate: 0.8 },
  Chiptune: { waveform: 'pulse', pulseWidth: 0.25, attack: 0.002, decay: 0.08, sustain: 0.5, release: 0.05, cutoff: 12000, gate: 0.6 },
  Bell: { waveform: 'sine', attack: 0.002, decay: 0.6, sustain: 0.05, release: 0.8, fmAmount: 0.6, cutoff: 9000, gate: 0.4 },
  Lead: { waveform: 'square', attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2, cutoff: 3500, resonance: 2, unison: 2, detune: 8, gate: 0.9 },
  Noise: { waveform: 'sine', noiseLevel: 0.7, attack: 0.002, decay: 0.1, sustain: 0.2, release: 0.1, cutoff: 8000, gate: 0.3 }
};
