import {
  DEFAULT_EFFECTS,
  SOUND_PRESETS,
  createSong,
  createTrack,
  type Effects,
  type Song,
  type SoundParams
} from './types';

const SIZE = 16;

type Sound = string | [string, Partial<SoundParams>];

interface TrackSpec {
  name: string;
  /** 16 steps. A number is a pitch index counted up from the lowest row in the song's scale, "." is a rest, "a,b" is two notes. */
  steps: string;
  sound?: Sound;
  volume?: number;
  pan?: number;
  reverb?: number;
}

interface SongSpec {
  name: string;
  description: string;
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

function build(spec: SongSpec): Song {
  const song = createSong();
  song.name = spec.name;
  song.tempo = spec.tempo;
  song.scale = spec.scale;
  song.gridSize = SIZE;
  song.swing = spec.swing ?? 0.5;
  song.humanizeTiming = spec.humanizeTiming ?? 0;
  song.humanizeVelocity = spec.humanizeVelocity ?? 0;
  song.effects = { ...DEFAULT_EFFECTS, ...spec.effects };
  song.tracks = spec.tracks.map((t) => {
    const track = createTrack(SIZE, t.name, soundParams(t.sound));
    track.volume = t.volume ?? 0.8;
    track.pan = t.pan ?? 0;
    track.reverbSend = t.reverb ?? 0.3;
    t.steps.trim().split(/\s+/).forEach((token, col) => {
      if (token === '.') return;
      for (const pitch of token.split(',')) {
        const row = SIZE - 1 - Number(pitch);
        if (col < SIZE && row >= 0 && row < SIZE) track.matrix[row][col] = true;
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
  }
];

export interface ExampleSong {
  id: string;
  name: string;
  description: string;
  create: () => Song;
}

export const EXAMPLE_SONGS: ExampleSong[] = SPECS.map((spec) => ({
  id: spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name: spec.name,
  description: spec.description,
  create: () => build(spec)
}));

export const SPEC_STEP_COUNT = SIZE;
export const RAW_SPECS = SPECS;
