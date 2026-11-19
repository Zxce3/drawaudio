import { findRowForMidi } from './scales';
import {
  DEFAULT_EFFECTS,
  SOUND_PRESETS,
  createSong,
  createTrack,
  type Effects,
  type Song,
  type SoundParams
} from './types';

const BAR = 16; // steps per bar: one bar is a 16-step pattern of sixteenth notes

type Sound = string | [string, Partial<SoundParams>];

export interface TrackSpec {
  name: string;
  /**
   * One string per bar of 16 steps (a single string is one bar; short bars are padded with rests).
   * Tokens: "." rest; a number is a pitch index counted up from the lowest row;
   * a note name such as "Eb4" is snapped to the nearest pitch of the song's scale;
   * "a,b" plays several notes at once.
   */
  steps: string | string[];
  sound?: Sound;
  volume?: number;
  pan?: number;
  reverb?: number;
}

export interface SongSpec {
  name: string;
  description: string;
  /** Grid size; the song has size / 16 bars */
  size?: 16 | 32 | 64;
  tempo: number;
  scale: string;
  swing?: number;
  humanizeTiming?: number;
  humanizeVelocity?: number;
  effects?: Partial<Effects>;
  tracks: TrackSpec[];
}

function soundParams(sound: Sound | undefined): Partial<SoundParams> {
  if (!sound) return {};
  const [name, extra] = typeof sound === 'string' ? [sound, {}] : sound;
  return { ...SOUND_PRESETS[name], ...extra };
}

const NOTE_OFFSETS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function noteToMidi(name: string): number | null {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!m) return null;
  return 12 * (Number(m[3]) + 1) + NOTE_OFFSETS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

/** Expand a track's bars into one token per grid column */
export function parseSteps(steps: string | string[]): string[] {
  const bars = Array.isArray(steps) ? steps : [steps];
  return bars.flatMap((bar) => {
    const tokens = bar.trim().split(/\s+/);
    if (tokens.length > BAR) throw new Error(`Bar has ${tokens.length} steps: ${bar}`);
    return [...tokens, ...Array<string>(BAR - tokens.length).fill('.')];
  });
}

export function build(spec: SongSpec): Song {
  const size = spec.size ?? 16;
  const song = createSong();
  song.name = spec.name;
  song.tempo = spec.tempo;
  song.scale = spec.scale;
  song.gridSize = size;
  song.swing = spec.swing ?? 0.5;
  song.humanizeTiming = spec.humanizeTiming ?? 0;
  song.humanizeVelocity = spec.humanizeVelocity ?? 0;
  song.effects = { ...DEFAULT_EFFECTS, ...spec.effects };
  song.tracks = spec.tracks.map((t) => {
    const track = createTrack(size, t.name, soundParams(t.sound));
    track.volume = t.volume ?? 0.8;
    track.pan = t.pan ?? 0;
    track.reverbSend = t.reverb ?? 0.3;
    parseSteps(t.steps).forEach((token, col) => {
      if (token === '.' || col >= size) return;
      for (const pitch of token.split(',')) {
        const midi = noteToMidi(pitch);
        const row = midi === null ? size - 1 - Number(pitch) : findRowForMidi(spec.scale, size, midi);
        if (row >= 0 && row < size) track.matrix[row][col] = true;
      }
    });
    return track;
  });
  return song;
}

const SPECS: SongSpec[] = [
  {
    name: 'First Light',
    description: 'A gentle pentatonic melody over a slow bass',
    tempo: 90,
    scale: 'Pentatonic',
    effects: { delayMix: 0.25, reverbMix: 0.35 },
    tracks: [
      { name: 'Lead', steps: '10 . 12 . 14 . 12 . 10 . 9 . 7 . . .', sound: 'Pluck', reverb: 0.4 },
      { name: 'Bass', steps: '0 . . . 2 . . . 3 . . . 2 . . .', sound: 'Bass', volume: 0.7, reverb: 0.1 },
      { name: 'Pad', steps: '5 . . . . . . . 7 . . . . . . .', sound: ['Pad', { chordEnabled: true, noteLength: 4 }], volume: 0.55, reverb: 0.6 }
    ]
  },
  {
    name: 'Midnight Drive',
    description: 'Minor key, pumping sidechain and a rolling bass',
    tempo: 100,
    scale: 'Minor',
    effects: { sidechainEnabled: true, sidechainAmount: 0.6, sidechainRelease: 0.22, delayMix: 0.3, reverbMix: 0.3 },
    tracks: [
      { name: 'Bass', steps: '0 . 0 . 0 . 3 . 0 . 0 . 5 . 4 .', sound: 'Bass', volume: 0.75, reverb: 0.05 },
      { name: 'Arp', steps: '7 . . . . . . . 8 . . . . . . .', sound: ['Lead', { chordEnabled: true, arpMode: 'up', arpNotes: 4, arpOctaves: 2 }], volume: 0.5, pan: -0.3 },
      { name: 'Melody', steps: '14 . . 12 . . 10 . 12 . . . 9 . . .', sound: ['Lead', { unison: 3, detune: 12 }], volume: 0.6, pan: 0.3 }
    ]
  },
  {
    name: 'Chip Quest',
    description: '8-bit adventure with a bouncing bass and noise hats',
    tempo: 140,
    scale: 'Major',
    effects: { reverbMix: 0.1, delayMix: 0.15 },
    tracks: [
      { name: 'Lead', steps: '12 . 12 14 . 11 . 9 11 . 12 . 14 . 11 .', sound: 'Chiptune', volume: 0.7, reverb: 0.1 },
      { name: 'Bass', steps: '0 . 0 . 4 . 4 . 3 . 3 . 4 . 4 .', sound: ['Chiptune', { pulseWidth: 0.5, cutoff: 3000 }], volume: 0.7, reverb: 0 },
      { name: 'Hats', steps: '. . 15 . . . 15 . . . 15 . . . 15 .', sound: 'Noise', volume: 0.35, reverb: 0.05 }
    ]
  },
  {
    name: 'Rain on Glass',
    description: 'Slow bells and a wide pad drenched in reverb',
    tempo: 70,
    scale: 'Pentatonic',
    effects: { reverbMix: 0.6, delayMode: 'pingpong', delayMix: 0.4, delayFeedback: 0.45, delaySync: true, delayDivision: '1/8d' },
    tracks: [
      { name: 'Bells', steps: '15 . . . 12 . . . 14 . . . 10 . 12 .', sound: 'Bell', reverb: 0.6 },
      { name: 'Pad', steps: '5 . . . . . . . 7 . . . . . . .', sound: ['Pad', { chordEnabled: true, chordType: '9th', noteLength: 4 }], volume: 0.5, reverb: 0.7 }
    ]
  },
  {
    name: 'Dorian Groove',
    description: 'Swung funk with stabbing chords',
    tempo: 110,
    scale: 'Dorian',
    swing: 0.6,
    humanizeTiming: 0.2,
    effects: { delayMode: 'slapback', delayMix: 0.2, reverbMix: 0.2 },
    tracks: [
      { name: 'Bass', steps: '0 . . 0 . 0 . . 3 . . 3 . 2 . .', sound: ['Bass', { subLevel: 0.4 }], volume: 0.8, reverb: 0 },
      { name: 'Stabs', steps: '. . 7 . . . 7 . . . 9 . . . 9 .', sound: ['Lead', { chordEnabled: true, chordType: '7th', gate: 0.35, unison: 1 }], volume: 0.5, pan: -0.25 },
      { name: 'Melody', steps: '14 . 12 . . 11 . 9 . . 11 . 12 . . .', sound: ['Pluck', { waveform: 'sawtooth' }], volume: 0.6, pan: 0.25 }
    ]
  },
  {
    name: 'Temple Bells',
    description: 'Japanese scale, a low drone and shimmering bells',
    tempo: 80,
    scale: 'Japanese',
    effects: { reverbMix: 0.5, delayMix: 0.3, delayMode: 'stereo' },
    tracks: [
      { name: 'Bells', steps: '10 . . 8 . . 7 . . . 5 . . 3 . .', sound: 'Bell', reverb: 0.5 },
      { name: 'High bells', steps: '. . . . 13 . . . . . . . 12 . . .', sound: ['Bell', { fmRatio: 3 }], volume: 0.45, pan: 0.4, reverb: 0.6 },
      { name: 'Drone', steps: '0 . . . . . . . . . . . . . . .', sound: ['Pad', { noteLength: 5, subLevel: 0.5, cutoff: 900 }], volume: 0.55, reverb: 0.3 }
    ]
  },
  {
    name: 'Neon Pulse',
    description: 'Synthwave arpeggios with chorus and stereo width',
    tempo: 120,
    scale: 'MinorPentatonic',
    effects: { sidechainEnabled: true, sidechainAmount: 0.55, chorusEnabled: true, chorus: 0.5, spreadEnabled: true, spread: 0.6, delayMix: 0.3 },
    tracks: [
      { name: 'Arp', steps: '5 . . . 7 . . . 4 . . . 6 . . .', sound: ['Lead', { chordEnabled: true, arpMode: 'updown', arpNotes: 4, arpOctaves: 2, unison: 3 }], volume: 0.5 },
      { name: 'Bass', steps: '0 . 0 0 . 0 . 0 0 . 0 0 . 0 . 0', sound: 'Bass', volume: 0.75, reverb: 0 },
      { name: 'Lead', steps: '. . . . 12 . 10 . . . . . 15 . 12 .', sound: ['Lead', { glide: 0.3 }], volume: 0.55, pan: 0.3 }
    ]
  },
  {
    name: 'Lofi Window',
    description: 'Dusty tape, vinyl crackle and loose timing',
    tempo: 75,
    scale: 'Dorian',
    swing: 0.58,
    humanizeTiming: 0.3,
    humanizeVelocity: 0.3,
    effects: { tapeEnabled: true, tapeWow: 0.4, tapeSaturation: 0.4, tapeHiss: 0.25, vinylEnabled: true, vinylCrackle: 0.45, vinylWarmth: 0.6, reverbMix: 0.3 },
    tracks: [
      { name: 'Keys', steps: '7 . . . . . 9 . . . 5 . . . . .', sound: ['Pluck', { chordEnabled: true, chordType: '7th', gate: 1, release: 0.5 }], volume: 0.6 },
      { name: 'Bass', steps: '0 . . . . . 0 . 3 . . . . 2 . .', sound: ['Bass', { cutoff: 500 }], volume: 0.7, reverb: 0 },
      { name: 'Melody', steps: '. . 14 . . 12 . . 11 . . . 9 . . .', sound: ['Bell', { fmAmount: 0.3 }], volume: 0.45, pan: 0.3 }
    ]
  },
  {
    name: 'Desert Wind',
    description: 'Phrygian lead on a vocal wavetable with reverse delay',
    tempo: 95,
    scale: 'Phrygian',
    effects: { delayMode: 'reverse', delayTime: 0.5, delayMix: 0.35, delayFeedback: 0.35, reverbMix: 0.4 },
    tracks: [
      {
        name: 'Voice',
        steps: '14 . . 13 . 12 . . 10 . . . 9 . . .',
        sound: ['Pad', { waveform: 'wavetable', wavetable: 'vocal', wavetablePos: 0.5, glide: 0.4, attack: 0.08, noteLength: 2 }],
        volume: 0.65,
        reverb: 0.5
      },
      { name: 'Bass', steps: '0 . . . . . 0 . . 1 . . . . 0 .', sound: ['Bass', { waveform: 'triangle' }], volume: 0.7, reverb: 0.05 }
    ]
  },
  {
    name: 'Sunrise Reggae',
    description: 'One-drop bass with offbeat skank chords',
    tempo: 85,
    scale: 'ReggaeMinor',
    humanizeTiming: 0.15,
    effects: { delayMode: 'mono', delaySync: true, delayDivision: '1/8d', delayMix: 0.3, delayFeedback: 0.4, reverbMix: 0.3 },
    tracks: [
      { name: 'Bass', steps: '0 . . . . . 3 . . . 0 . . . 2 .', sound: ['Bass', { waveform: 'sine', subLevel: 0.3, cutoff: 900 }], volume: 0.85, reverb: 0 },
      { name: 'Skank', steps: '. . . . 7 . . . . . . . 7 . . .', sound: ['Pluck', { chordEnabled: true, gate: 0.3, waveform: 'square', cutoff: 2500 }], volume: 0.5, pan: -0.3 },
      { name: 'Lead', steps: '. . 14 . 12 . . . 11 . . . . . 9 .', sound: ['Lead', { waveform: 'triangle', unison: 1 }], volume: 0.55, pan: 0.3 }
    ]
  }  ,
  // ------------------------------------------------------------------ 32x32 (2 bars)
  {
    name: 'Harbor Lights',
    description: 'Mixolydian sea shanty with a rolling bass (2 bars)',
    size: 32,
    tempo: 105,
    scale: 'Mixolydian',
    effects: { reverbMix: 0.35, delayMix: 0.25, delayMode: 'stereo' },
    tracks: [
      {
        name: 'Lead',
        steps: ['. . E5 . G5 . A5 G5 . E5 . D5 . . C5 .', 'A5 . . G5 . F5 . E5 . . D5 . C5 . . .'],
        sound: ['Pluck', { waveform: 'sawtooth', cutoff: 3500 }],
        volume: 0.65,
        pan: 0.2
      },
      {
        name: 'Bass',
        steps: ['C3 . . C3 . . G2 . C3 . . C3 . Bb2 . .', 'F3 . . F3 . . C3 . F3 . . F3 . G3 . .'],
        sound: 'Bass',
        volume: 0.7,
        reverb: 0.05
      },
      {
        name: 'Pad',
        steps: ['C4', 'F4'],
        sound: ['Pad', { chordEnabled: true, noteLength: 5 }],
        volume: 0.45,
        reverb: 0.6
      }
    ]
  },
  {
    name: 'Glass Cathedral',
    description: 'Slow Lydian bells under a shimmering drone (2 bars)',
    size: 32,
    tempo: 70,
    scale: 'Lydian',
    effects: { reverbMix: 0.6, reverbDecay: 1, delayMode: 'pingpong', delaySync: true, delayDivision: '1/8d', delayMix: 0.4, delayFeedback: 0.45 },
    tracks: [
      {
        name: 'Bells',
        steps: ['E5 . . B5 . . A5 . . F#5 . . G5 . . .', 'D5 . . A5 . . G5 . . E5 . . F#5 . . .'],
        sound: 'Bell',
        reverb: 0.6
      },
      { name: 'Shimmer', steps: ['E6 . . . . . . . B5 . . . . . . .', 'D6 . . . . . . . A5 . . . . . . .'], sound: ['Bell', { fmRatio: 4, release: 1.2 }], volume: 0.35, pan: -0.4, reverb: 0.8 },
      { name: 'Drone', steps: ['C3', 'C3'], sound: ['Pad', { noteLength: 5, subLevel: 0.5, cutoff: 800, chordEnabled: true, chordType: 'power' }], volume: 0.5, reverb: 0.4 }
    ]
  },
  {
    name: 'Brass Knuckle',
    description: 'Blues-scale riff with a gritty lead (2 bars)',
    size: 32,
    tempo: 120,
    scale: 'Blues',
    swing: 0.58,
    humanizeVelocity: 0.25,
    effects: { distortionEnabled: true, distortion: 12, reverbMix: 0.2, delayMode: 'slapback', delayMix: 0.2 },
    tracks: [
      {
        name: 'Bass',
        steps: ['C3 . C3 Eb3 . F3 . F#3 G3 . . Bb3 . G3 . .', 'C3 . C3 Eb3 . F3 . F#3 G3 . F3 . Eb3 . C3 .'],
        sound: ['Bass', { waveform: 'square', cutoff: 900 }],
        volume: 0.75,
        reverb: 0
      },
      {
        name: 'Stabs',
        steps: ['. . . . C4,G4 . . . . . . . C4,G4 . . .', '. . . . C4,G4 . . . . . . . F4,C5 . . .'],
        sound: ['Lead', { gate: 0.3, unison: 2 }],
        volume: 0.45,
        pan: -0.3
      },
      {
        name: 'Lick',
        steps: ['. . . . G4 . Bb4 . C5 . . . Bb4 . G4 .', 'F4 . F#4 . G4 . . . . . . . . . . .'],
        sound: ['Lead', { waveform: 'sawtooth', glide: 0.3 }],
        volume: 0.55,
        pan: 0.3
      }
    ]
  },
  {
    name: 'Paper Boats',
    description: 'A music-box lullaby in C major (2 bars)',
    size: 32,
    tempo: 96,
    scale: 'Major',
    humanizeTiming: 0.15,
    effects: { reverbMix: 0.45, delayMix: 0.25, delayMode: 'pingpong' },
    tracks: [
      {
        name: 'Music box',
        steps: ['E5 . G5 . C6 . G5 . E5 . G5 . D5 . . .', 'F5 . A5 . C6 . A5 . F5 . A5 . G5 . . .'],
        sound: ['Bell', { fmAmount: 0.35, release: 0.9 }],
        volume: 0.6,
        pan: 0.2
      },
      {
        name: 'Bass',
        steps: ['C3 . . . G3 . . . E3 . . . G3 . . .', 'F3 . . . C4 . . . A3 . . . C4 . . .'],
        sound: ['Pluck', { waveform: 'sine', subLevel: 0.3, gate: 0.8 }],
        volume: 0.7,
        reverb: 0.1
      },
      { name: 'Hum', steps: ['C4', 'F4'], sound: ['Pad', { chordEnabled: true, noteLength: 5 }], volume: 0.35, reverb: 0.7 }
    ]
  },
  {
    name: 'Iron Orchard',
    description: 'Driving harmonic-minor synth with octave bass (2 bars)',
    size: 32,
    tempo: 128,
    scale: 'HarmonicMinor',
    effects: { sidechainEnabled: true, sidechainAmount: 0.55, sidechainDivision: '1/4', spreadEnabled: true, spread: 0.5, delayMix: 0.3, reverbMix: 0.25 },
    tracks: [
      {
        name: 'Bass',
        steps: ['C3 . C3 C4 . C3 . C4 C3 . C3 C4 . C3 . C4', 'Ab2 . Ab2 Ab3 . Ab2 . Ab3 G2 . G2 G3 . G2 . G3'],
        sound: ['Bass', { subLevel: 0.3 }],
        volume: 0.75,
        reverb: 0
      },
      {
        name: 'Arp',
        steps: ['C5', 'Ab4'],
        sound: ['Lead', { chordEnabled: true, arpMode: 'updown', arpNotes: 4, arpOctaves: 2, unison: 3, noteLength: 5 }],
        volume: 0.4,
        pan: -0.3
      },
      {
        name: 'Lead',
        steps: ['. . . . G5 . Ab5 . B5 . . . C6 . . .', 'B5 . Ab5 . G5 . F5 . . . . . . . . .'],
        sound: ['Lead', { glide: 0.25 }],
        volume: 0.55,
        pan: 0.3
      }
    ]
  },

  // ------------------------------------------------------------------ 64x64 (4 bars)
  {
    name: 'Long Road Home',
    description: 'C - Am - F - G progression with a singing melody (4 bars)',
    size: 64,
    tempo: 88,
    scale: 'Major',
    humanizeTiming: 0.15,
    effects: { reverbMix: 0.4, delayMix: 0.25, delayMode: 'pingpong', delaySync: true, delayDivision: '1/8d' },
    tracks: [
      {
        name: 'Melody',
        steps: [
          'E5 . . G5 . . E5 . D5 . C5 . . . . .',
          'C5 . . E5 . . A4 . . . C5 . . . . .',
          'A5 . . F5 . . C5 . A4 . . . . . . .',
          'B4 . D5 . G5 . . . F5 . D5 . B4 . . .'
        ],
        sound: ['Pluck', { waveform: 'triangle', release: 0.4 }],
        volume: 0.65,
        pan: 0.2
      },
      {
        name: 'Pad',
        steps: ['C4', 'A3', 'F3', 'G3'],
        sound: ['Pad', { chordEnabled: true, noteLength: 5 }],
        volume: 0.45,
        reverb: 0.6
      },
      {
        name: 'Bass',
        steps: [
          'C3 . . C3 . . C3 . C3 . . . G2 . . .',
          'A2 . . A2 . . A2 . A2 . . . E3 . . .',
          'F2 . . F2 . . F2 . F2 . . . C3 . . .',
          'G2 . . G2 . . G2 . G2 . . . D3 . . .'
        ],
        sound: ['Bass', { waveform: 'triangle', subLevel: 0.3 }],
        volume: 0.7,
        reverb: 0.05
      }
    ]
  },
  {
    name: 'Static Bloom',
    description: 'Ambient Dorian chords with sparse bells and ping-pong echoes (4 bars)',
    size: 64,
    tempo: 100,
    scale: 'Dorian',
    effects: { reverbMix: 0.55, delayMode: 'pingpong', delayMix: 0.4, delayFeedback: 0.5, delaySync: true, delayDivision: '1/8d', chorusEnabled: true, chorus: 0.4 },
    tracks: [
      {
        name: 'Chords',
        steps: ['C4', 'F3', 'Bb3', 'Eb4'],
        sound: ['Pad', { chordEnabled: true, chordType: '7th', noteLength: 5, attack: 0.4, release: 1 }],
        volume: 0.5,
        reverb: 0.7
      },
      {
        name: 'Bells',
        steps: [
          'G5 . . . . . Bb5 . . . . . D6 . . .',
          'A5 . . . . . C6 . . . . . F5 . . .',
          'F5 . . . . . D5 . . . . . Bb5 . . .',
          'Eb5 . . . . . G5 . . . . . Bb5 . . .'
        ],
        sound: ['Bell', { release: 1.2 }],
        volume: 0.5,
        pan: 0.3,
        reverb: 0.7
      },
      {
        name: 'Sub',
        steps: ['C2', 'F2', 'Bb2', 'Eb2'],
        sound: ['Bass', { waveform: 'sine', noteLength: 5, subLevel: 0.4, cutoff: 500 }],
        volume: 0.55,
        reverb: 0.1
      },
      {
        name: 'Arp',
        steps: ['. . . . C5 . . . . . . . . . . .', '. . . . F5 . . . . . . . . . . .', '. . . . Bb4 . . . . . . . . . . .', '. . . . Eb5 . . . . . . . . . . .'],
        sound: ['Pluck', { chordEnabled: true, arpMode: 'up', arpNotes: 4, arpOctaves: 2 }],
        volume: 0.35,
        pan: -0.35,
        reverb: 0.5
      }
    ]
  },
  {
    name: 'Neon Harbor',
    description: 'Four bars of synth-pop in C minor pentatonic with a pumping mix',
    size: 64,
    tempo: 124,
    scale: 'MinorPentatonic',
    effects: { sidechainEnabled: true, sidechainAmount: 0.6, sidechainRelease: 0.2, chorusEnabled: true, chorus: 0.5, spreadEnabled: true, spread: 0.5, delayMix: 0.3, reverbMix: 0.3 },
    tracks: [
      {
        name: 'Bass',
        steps: [
          'C3 . C3 C3 . C3 . C3 C3 . C3 C3 . C3 . C3',
          'Eb3 . Eb3 Eb3 . Eb3 . Eb3 Eb3 . Eb3 Eb3 . Eb3 . Eb3',
          'F3 . F3 F3 . F3 . F3 F3 . F3 F3 . F3 . F3',
          'Bb2 . Bb2 Bb2 . Bb2 . Bb2 Bb2 . Bb2 Bb2 . Bb2 . Bb2'
        ],
        sound: 'Bass',
        volume: 0.75,
        reverb: 0
      },
      {
        name: 'Arp',
        steps: ['C5', 'Eb5', 'F5', 'Bb4'],
        sound: ['Lead', { chordEnabled: true, arpMode: 'updown', arpNotes: 4, arpOctaves: 2, unison: 3, noteLength: 5 }],
        volume: 0.4,
        pan: -0.3
      },
      {
        name: 'Hook',
        steps: [
          '. . . . G5 . F5 . . . Eb5 . F5 . . .',
          '. . . . Bb5 . G5 . . . F5 . G5 . . .',
          '. . . . C6 . Bb5 . . . G5 . F5 . . .',
          'Eb5 . F5 . G5 . . . F5 . Eb5 . C5 . . .'
        ],
        sound: ['Lead', { glide: 0.25, unison: 2 }],
        volume: 0.55,
        pan: 0.3
      },
      {
        name: 'Hats',
        steps: ['. . G6 . . . G6 . . . G6 . . . G6 .', '. . G6 . . . G6 . . . G6 . . . G6 G6', '. . G6 . . . G6 . . . G6 . . . G6 .', '. . G6 . . . G6 G6 . . G6 . G6 G6 G6 G6'],
        sound: 'Noise',
        volume: 0.28,
        pan: 0.15,
        reverb: 0.1
      }
    ]
  },
  {
    name: 'Ember Caravan',
    description: 'Phrygian trek: vocal wavetable lead, drone and reverse echoes (4 bars)',
    size: 64,
    tempo: 110,
    scale: 'Phrygian',
    humanizeTiming: 0.1,
    effects: { delayMode: 'reverse', delayTime: 0.5, delayMix: 0.35, delayFeedback: 0.35, reverbMix: 0.4, tapeEnabled: true, tapeWow: 0.2, tapeSaturation: 0.3, tapeHiss: 0.1 },
    tracks: [
      {
        name: 'Voice',
        steps: [
          'G5 . . Ab5 . G5 . F5 . . Eb5 . . . . .',
          'F5 . . G5 . F5 . Eb5 . . Db5 . . . . .',
          'Eb5 . . F5 . G5 . Ab5 . . Bb5 . . . . .',
          'Ab5 . . G5 . F5 . Eb5 . . C5 . . . . .'
        ],
        sound: ['Pad', { waveform: 'wavetable', wavetable: 'vocal', wavetablePos: 0.5, glide: 0.4, attack: 0.08, noteLength: 2 }],
        volume: 0.65,
        reverb: 0.5
      },
      {
        name: 'Bass',
        steps: [
          'C3 . . . . . C3 . . Db3 . . . . C3 .',
          'C3 . . . . . C3 . . Db3 . . . . C3 .',
          'Ab2 . . . . . Ab2 . . Bb2 . . . . Ab2 .',
          'Bb2 . . . . . Bb2 . . Db3 . . . . C3 .'
        ],
        sound: ['Bass', { waveform: 'triangle' }],
        volume: 0.7,
        reverb: 0.05
      },
      {
        name: 'Drone',
        steps: ['C3,G3', 'C3,G3', 'Ab2,Eb3', 'Bb2,F3'],
        sound: ['Pad', { noteLength: 5, cutoff: 700, subLevel: 0.4, unison: 3 }],
        volume: 0.4,
        reverb: 0.4
      }
    ]
  },
  {
    name: 'Skyline Run',
    description: 'Fast chiptune chase with ratchets and noise hats (4 bars)',
    size: 64,
    tempo: 150,
    scale: 'Mixolydian',
    effects: { reverbMix: 0.12, delayMix: 0.18, delayMode: 'stereo', delaySync: true, delayDivision: '1/8' },
    tracks: [
      {
        name: 'Lead',
        steps: [
          'E5 . G5 . A5 . G5 . E5 . D5 . C5 . D5 .',
          'E5 . G5 . A5 . C6 . Bb5 . A5 . G5 . . .',
          'F5 . A5 . C6 . A5 . F5 . A5 . G5 . F5 .',
          'E5 . G5 . Bb5 . A5 . G5 . E5 . C5 . . .'
        ],
        sound: ['Chiptune', { pulseWidth: 0.25 }],
        volume: 0.65,
        reverb: 0.1
      },
      {
        name: 'Arp',
        steps: ['C4', 'C4', 'F4', 'G4'],
        sound: ['Chiptune', { chordEnabled: true, arpMode: 'up', arpNotes: 4, arpOctaves: 1, pulseWidth: 0.5, noteLength: 5 }],
        volume: 0.35,
        pan: -0.35,
        reverb: 0.1
      },
      {
        name: 'Bass',
        steps: [
          'C3 . C3 . C3 . C3 . C3 . C3 . G2 . G2 .',
          'C3 . C3 . C3 . C3 . Bb2 . Bb2 . G2 . G2 .',
          'F3 . F3 . F3 . F3 . F3 . F3 . C3 . C3 .',
          'G2 . G2 . G2 . G2 . G2 . D3 . G2 . G2 .'
        ],
        sound: ['Chiptune', { pulseWidth: 0.5, cutoff: 2500, ratchet: 2 }],
        volume: 0.6,
        reverb: 0
      },
      {
        name: 'Hats',
        steps: ['. . A6 . . . A6 . . . A6 . . . A6 A6', '. . A6 . . . A6 . . . A6 . . . A6 .', '. . A6 . . . A6 . . . A6 . . . A6 A6', '. . A6 . . . A6 . . . A6 . A6 A6 A6 A6'],
        sound: ['Noise', { ratchet: 2 }],
        volume: 0.25,
        reverb: 0.05
      }
    ]
  }
  ,
  {
    name: 'Warm Heart Riddim',
    description: 'Original one-drop reggae in C major: offbeat skank, bubbling organ and dub echoes (4 bars)',
    size: 64,
    tempo: 76,
    scale: 'Major',
    humanizeTiming: 0.12,
    humanizeVelocity: 0.15,
    effects: {
      reverbMix: 0.35,
      delayMode: 'pingpong',
      delaySync: true,
      delayDivision: '1/8d',
      delayFeedback: 0.45,
      delayMix: 0.3,
      tapeEnabled: true,
      tapeWow: 0.25,
      tapeSaturation: 0.3,
      tapeHiss: 0.1
    },
    tracks: [
      {
        // One drop: the kick and the rim both land only on beat three
        name: 'Kick',
        steps: ['. . . . . . . . C2', '. . . . . . . . C2', '. . . . . . . . C2', '. . . . . . . . C2 . . . . . C2'],
        sound: ['Clean', { waveform: 'sine', pitchEnvEnabled: true, pitchEnvSemitones: 20, pitchEnvTime: 0.1, attack: 0.001, decay: 0.18, sustain: 0, release: 0.12, cutoff: 6000, gate: 0.35 }],
        volume: 0.9,
        reverb: 0.1
      },
      {
        name: 'Rim',
        steps: ['. . . . . . . . G5', '. . . . . . . . G5', '. . . . . . . . G5', '. . . . . . . . G5'],
        sound: ['Noise', { waveform: 'square', noiseLevel: 0.85, attack: 0.001, decay: 0.05, sustain: 0, release: 0.06, cutoff: 7000, gate: 0.12 }],
        volume: 0.45,
        pan: 0.1,
        reverb: 0.4
      },
      {
        name: 'Hats',
        steps: ['A6 . A6 . A6 . A6 . A6 . A6 . A6 . A6 .', 'A6 . A6 . A6 . A6 . A6 . A6 . A6 . A6 .', 'A6 . A6 . A6 . A6 . A6 . A6 . A6 . A6 .', 'A6 . A6 . A6 . A6 . A6 . A6 . A6 . A6 A6'],
        sound: ['Noise', { noiseLevel: 0.9, gate: 0.1, hpEnabled: true, hpCutoff: 6000 }],
        volume: 0.22,
        pan: 0.25,
        reverb: 0.15
      },
      {
        name: 'Bass',
        steps: ['C3 . . C3 . . . . . . G2 . C3 . . .', 'F3 . . F3 . . . . . . C3 . F3 . . .', 'C3 . . C3 . . . . . . G2 . C3 . E3 .', 'G2 . . G2 . . . . . . D3 . G2 . B2 .'],
        sound: ['Bass', { waveform: 'sine', subLevel: 0.5, cutoff: 700, attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.15, gate: 0.75 }],
        volume: 0.85,
        reverb: 0
      },
      {
        // Chords chopped on every offbeat: the "skank"
        name: 'Skank',
        steps: ['. . C4 . . . C4 . . . C4 . . . C4 .', '. . F4 . . . F4 . . . F4 . . . F4 .', '. . C4 . . . C4 . . . C4 . . . C4 .', '. . G3 . . . G3 . . . G3 . . . G3 .'],
        sound: ['Pluck', { waveform: 'square', chordEnabled: true, gate: 0.22, cutoff: 2600, attack: 0.002, release: 0.08 }],
        volume: 0.5,
        pan: -0.3,
        reverb: 0.3
      },
      {
        // The organ "bubble"
        name: 'Organ',
        steps: ['C4 . . C4 . . . . C4 . . C4', 'F4 . . F4 . . . . F4 . . F4', 'C4 . . C4 . . . . C4 . . C4', 'G3 . . G3 . . . . G3 . . G3'],
        sound: ['Pad', { waveform: 'wavetable', wavetable: 'organ', wavetablePos: 0.4, chordEnabled: true, gate: 0.3, attack: 0.005, release: 0.1, sustain: 0.6, cutoff: 3500 }],
        volume: 0.45,
        pan: 0.3,
        reverb: 0.25
      },
      {
        name: 'Melody',
        steps: ['. . E5 . G5 . . . A5 . G5 . E5', '. . F5 . A5 . . . C6 . A5 . F5', '. . E5 . G5 . . . A5 . C6 . B5 . A5', 'G5 . . . D5 . E5'],
        sound: ['Lead', { waveform: 'triangle', unison: 1, glide: 0.2, attack: 0.02, release: 0.3, gate: 0.85 }],
        volume: 0.5,
        pan: 0.1,
        reverb: 0.5
      }
    ]
  }
];

export interface ExampleSong {
  id: string;
  size: number;
  name: string;
  description: string;
  create: () => Song;
}

export const EXAMPLE_SONGS: ExampleSong[] = SPECS.map((spec) => ({
  id: spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  size: spec.size ?? 16,
  name: spec.name,
  description: spec.description,
  create: () => build(spec)
}));

export const RAW_SPECS = SPECS;
