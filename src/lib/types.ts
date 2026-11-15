export type Waveform = 'sine' | 'sawtooth' | 'triangle' | 'square' | 'pulse';
export type PlaybackPattern = 'forward' | 'backward' | 'bounce' | 'random';
export type ImpulseType = 'reverb' | 'guitar' | 'drum';

export const GRID_SIZES = [8, 16, 32, 64] as const;
export const TIME_SIGNATURES = [2, 3, 4, 5, 6, 7] as const; // beats per bar, x/4

export type ArpMode = 'off' | 'up' | 'down' | 'updown' | 'random' | 'pedal' | 'converge' | 'diverge';
export type ChordType = 'triad' | '7th' | '9th' | 'add9' | 'sus2' | 'sus4' | 'power' | 'octave';
export type DelayMode = 'pingpong' | 'mono' | 'stereo' | 'slapback';
export type DelayDivision = '1/4' | '1/8' | '1/16' | '1/8d';

/** Per-track voice and sequencing settings */
export interface SoundParams {
  waveform: Waveform;
  pulseWidth: number; // 0.05 - 0.95 (pulse only)
  attack: number; // seconds
  decay: number;
  sustain: number; // 0 - 1
  release: number;
  // filters
  lpEnabled: boolean;
  cutoff: number; // Hz
  resonance: number; // Q
  hpEnabled: boolean;
  hpCutoff: number;
  hpResonance: number;
  filterEnvEnabled: boolean;
  filterEnvAmount: number; // 0 - 1 (up to 4 octaves of sweep)
  // pitch envelope
  pitchEnvEnabled: boolean;
  pitchEnvSemitones: number; // -24 - 24
  pitchEnvTime: number; // seconds
  // oscillator
  subLevel: number; // 0 - 1
  noiseLevel: number; // 0 - 1
  unison: number; // 1 - 8 voices
  detune: number; // cents spread
  fmAmount: number; // 0 - 1
  fmRatio: number; // 0.5 - 8
  // groove
  gate: number; // 0.1 - 1 fraction of the note that is held
  noteLength: number; // 1 - 5 (1, 2, 4, 8, 16 steps)
  ratchet: number; // 1 - 4 repeats per step
  glide: number; // 0 - 1
  // arpeggio
  arpMode: ArpMode;
  arpNotes: number; // arp notes per column, 1 - 8
  arpOctaves: number; // 1 - 4
  arpFit: boolean; // arp notes fill the step
  arpRetrigger: boolean; // restart the arp every column
  // chords
  chordEnabled: boolean;
  chordType: ChordType;
  chordInversion: number; // 0 - 3
}

/** Numeric limits used to validate untrusted input */
export const PARAM_RANGES: Record<string, [number, number]> = {
  pulseWidth: [0.05, 0.95], attack: [0, 2], decay: [0, 2], sustain: [0, 1], release: [0, 4],
  cutoff: [100, 20000], resonance: [0, 20], hpCutoff: [20, 4000], hpResonance: [0, 20],
  filterEnvAmount: [0, 1], pitchEnvSemitones: [-24, 24], pitchEnvTime: [0.005, 1],
  subLevel: [0, 1], noiseLevel: [0, 1], unison: [1, 8], detune: [0, 100], fmAmount: [0, 1], fmRatio: [0.5, 8],
  gate: [0.1, 1], noteLength: [1, 5], ratchet: [1, 4], glide: [0, 1],
  arpNotes: [1, 8], arpOctaves: [1, 4], chordInversion: [0, 3],
  delayTime: [0.01, 1], delayFeedback: [0, 0.9], delayMix: [0, 1], reverbMix: [0, 1], reverbDecay: [0.1, 1],
  distortion: [0, 50], chorus: [0, 1], spread: [0, 1], ringFreq: [20, 2000], ringMix: [0, 1],
  eqLow: [-12, 12], eqMid: [-12, 12], eqHigh: [-12, 12]
};

export const PARAM_CHOICES: Record<string, readonly string[]> = {
  waveform: ['sine', 'sawtooth', 'triangle', 'square', 'pulse'],
  arpMode: ['off', 'up', 'down', 'updown', 'random', 'pedal', 'converge', 'diverge'],
  chordType: ['triad', '7th', '9th', 'add9', 'sus2', 'sus4', 'power', 'octave'],
  delayMode: ['pingpong', 'mono', 'stereo', 'slapback'],
  delayDivision: ['1/4', '1/8', '1/16', '1/8d'],
  impulse: ['reverb', 'guitar', 'drum']
};

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
  reverbEnabled: boolean;
  reverbMix: number; // 0 - 1
  reverbDecay: number; // 0.1 - 1
  impulse: ImpulseType;
  delayEnabled: boolean;
  delayMode: DelayMode;
  delaySync: boolean;
  delayDivision: DelayDivision;
  delayTime: number; // seconds (when not synced)
  delayFeedback: number; // 0 - 0.9
  delayMix: number; // 0 - 1
  distortionEnabled: boolean;
  distortion: number; // 0 - 50
  spreadEnabled: boolean;
  spread: number; // 0 - 1
  chorusEnabled: boolean;
  chorus: number; // 0 - 1
  ringEnabled: boolean;
  ringFreq: number;
  ringMix: number;
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
  swing: number; // 0.25 - 0.75, 0.5 = straight
  humanizeTiming: number; // 0 - 1
  humanizeVelocity: number; // 0 - 1
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
  lpEnabled: true,
  cutoff: 6000,
  resonance: 0.7,
  hpEnabled: false,
  hpCutoff: 120,
  hpResonance: 0.7,
  filterEnvEnabled: false,
  filterEnvAmount: 0.5,
  pitchEnvEnabled: false,
  pitchEnvSemitones: 12,
  pitchEnvTime: 0.08,
  subLevel: 0,
  noiseLevel: 0,
  unison: 1,
  detune: 10,
  fmAmount: 0,
  fmRatio: 2,
  gate: 0.9,
  noteLength: 1,
  ratchet: 1,
  glide: 0,
  arpMode: 'off',
  arpNotes: 4,
  arpOctaves: 1,
  arpFit: true,
  arpRetrigger: true,
  chordEnabled: false,
  chordType: 'triad',
  chordInversion: 0
};

export const DEFAULT_EFFECTS: Effects = {
  reverbEnabled: true,
  reverbMix: 0.3,
  reverbDecay: 1,
  impulse: 'reverb',
  delayEnabled: true,
  delayMode: 'pingpong',
  delaySync: false,
  delayDivision: '1/8',
  delayTime: 0.3,
  delayFeedback: 0.3,
  delayMix: 0.3,
  distortionEnabled: false,
  distortion: 10,
  spreadEnabled: false,
  spread: 0.5,
  chorusEnabled: false,
  chorus: 0.5,
  ringEnabled: false,
  ringFreq: 300,
  ringMix: 0.5,
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
    swing: 0.5,
    humanizeTiming: 0,
    humanizeVelocity: 0,
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
