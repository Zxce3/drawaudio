import { expect, test } from 'bun:test';
import { exportMidi, midiToSong, parseMidi } from '../src/lib/midi';
import { findRowForMidi, getRowPitch } from '../src/lib/scales';
import { packMatrix, sanitizeSong, toCompact, unpackMatrix } from '../src/lib/storage';
import { createSong, createTrack } from '../src/lib/types';

test('row pitch: top row is highest, range stays audible', () => {
  for (const size of [8, 16, 32, 64]) {
    const top = getRowPitch('Major', size, 0).frequency;
    const bottom = getRowPitch('Major', size, size - 1).frequency;
    expect(top).toBeGreaterThan(bottom);
    expect(top).toBeLessThan(5000);
    expect(bottom).toBeGreaterThan(60);
  }
});

test('matrix packing round-trips', () => {
  const song = createSong();
  const m = song.tracks[0].matrix;
  m[0][0] = m[3][5] = m[15][15] = true;
  const back = unpackMatrix(packMatrix(m), 16);
  expect(back).toEqual(m);
});

test('sanitize clamps and repairs bad input', () => {
  const song = sanitizeSong({ tempo: 99999, gridSize: 7, scale: 'nope', tracks: [{ volume: 5 }] });
  expect(song.tempo).toBe(240);
  expect(song.gridSize).toBe(16);
  expect(song.scale).toBe('Pentatonic');
  expect(song.tracks[0].volume).toBe(1);
  expect(sanitizeSong(null).tracks.length).toBe(1);
});

test('compact form survives sanitize', () => {
  const song = createSong();
  song.tracks[0].matrix[2][4] = true;
  song.tempo = 123;
  const back = sanitizeSong(JSON.parse(JSON.stringify(toCompact(song))));
  expect(back.tempo).toBe(123);
  expect(back.tracks[0].matrix[2][4]).toBe(true);
});

test('MIDI export then import keeps notes', () => {
  const song = createSong();
  song.gridSize = 16;
  song.tracks = [createTrack(16, 'Lead'), createTrack(16, 'Bass')];
  song.tracks[0].matrix[3][0] = song.tracks[0].matrix[3][1] = true; // one long note
  song.tracks[0].matrix[7][8] = true;
  song.tracks[1].matrix[12][4] = true;
  song.tempo = 100;
  const parsed = parseMidi(exportMidi(song));
  expect(parsed.tempo).toBe(100);
  expect(parsed.tracks.length).toBe(2);
  expect(parsed.tracks[0].notes.length).toBe(2);
  const back = midiToSong(parsed, song, 'x.mid');
  expect(back.name).toBe('x');
  expect(back.tracks[0].matrix[3][0]).toBe(true);
  expect(back.tracks[0].matrix[3][1]).toBe(true);
  expect(back.tracks[0].matrix[7][8]).toBe(true);
  expect(back.tracks[1].matrix[12][4]).toBe(true);
  expect(findRowForMidi(song.scale, 16, getRowPitch(song.scale, 16, 5).midi)).toBe(5);
});

test('rejects non-MIDI data', () => {
  expect(() => parseMidi(new Uint8Array([1, 2, 3]))).toThrow();
});

test('sanitize validates new voice and effect settings', () => {
  const song = sanitizeSong({
    swing: 9,
    effects: { delayMode: 'bogus', reverbDecay: -3, distortion: 20 },
    tracks: [{ params: { arpMode: 'nope', ratchet: 99, chordEnabled: 'yes', unison: 3.4 } }]
  });
  expect(song.swing).toBe(0.75);
  expect(song.effects.delayMode).toBe('pingpong');
  expect(song.effects.reverbDecay).toBe(0.1);
  expect(song.effects.distortionEnabled).toBe(true); // legacy song with distortion keeps it on
  expect(song.tracks[0].params.arpMode).toBe('off');
  expect(song.tracks[0].params.ratchet).toBe(4);
  expect(song.tracks[0].params.chordEnabled).toBe(false);
  expect(song.tracks[0].params.unison).toBe(3);
});

import { filterResponse } from '../src/lib/filter';
import { wavetableHarmonics, wavetableShape } from '../src/lib/wavetables';

test('lowpass response falls off above the cutoff', () => {
  const r = filterResponse({ lpEnabled: true, cutoff: 1000, resonance: 0, hpEnabled: false, hpCutoff: 20, hpResonance: 0 });
  const at = (f: number) => r.reduce((a, b) => (Math.abs(b.freq - f) < Math.abs(a.freq - f) ? b : a)).db;
  expect(at(100)).toBeGreaterThan(-1);
  expect(at(10000)).toBeLessThan(-30);
});

test('wavetables are normalised and morph between frames', () => {
  for (const table of ['organ', 'vocal', 'glass', 'sweep'] as const) {
    const h = wavetableHarmonics(table, 0.5);
    expect(Math.max(...h)).toBeCloseTo(1, 5);
    const a = wavetableShape(table, 0);
    const b = wavetableShape(table, 1);
    expect(a.some((v, i) => Math.abs(v - b[i]) > 0.05)).toBe(true);
  }
});

test('sanitize accepts new playback and delay modes', () => {
  const s = sanitizeSong({ pattern: 'columns', effects: { delayMode: 'reverse', sidechainDivision: '1/16' }, tracks: [{ params: { waveform: 'wavetable', wavetable: 'vocal' } }] });
  expect(s.pattern).toBe('columns');
  expect(s.effects.delayMode).toBe('reverse');
  expect(s.effects.sidechainDivision).toBe('1/16');
  expect(s.tracks[0].params.waveform).toBe('wavetable');
  expect(s.tracks[0].params.wavetable).toBe('vocal');
});

import { EXAMPLE_SONGS, RAW_SPECS, parseSteps } from '../src/lib/songs';

test('there are 20 valid example songs across three grid sizes', () => {
  expect(EXAMPLE_SONGS.length).toBe(20);
  expect(new Set(EXAMPLE_SONGS.map((s) => s.id)).size).toBe(20);
  for (const size of [16, 32, 64]) expect(EXAMPLE_SONGS.filter((s) => s.size === size).length).toBe(size === 16 ? 10 : 5);
  for (const spec of RAW_SPECS) {
    for (const t of spec.tracks) {
      const tokens = parseSteps(t.steps);
      expect(tokens.length).toBe(spec.size ?? 16);
      for (const tok of tokens) {
        if (tok === '.') continue;
        for (const n of tok.split(',')) expect(/^[A-G][#b]?\d$/.test(n) || Number(n) >= 0).toBe(true);
      }
    }
  }
  for (const example of EXAMPLE_SONGS) {
    const song = example.create();
    expect(song.gridSize).toBe(example.size);
    expect(song.tracks.length).toBeGreaterThan(0);
    for (const track of song.tracks) {
      expect(track.matrix.length).toBe(example.size);
      expect(track.matrix.flat().some(Boolean)).toBe(true);
    }
    const clean = sanitizeSong(JSON.parse(JSON.stringify(toCompact(song))));
    expect(clean.scale).toBe(song.scale);
    expect(clean.gridSize).toBe(song.gridSize);
    expect(clean.tracks.length).toBe(song.tracks.length);
    expect(clean.tracks[0].matrix).toEqual(song.tracks[0].matrix);
    expect(clean.effects.delayMode).toBe(song.effects.delayMode);
  }
});

test('named notes land on the right pitch', () => {
  const song = EXAMPLE_SONGS.find((s) => s.id === 'harbor-lights')!.create();
  const bass = song.tracks[1];
  const rowOf = (col: number) => bass.matrix.findIndex((row) => row[col]);
  const midi = (col: number) => getRowPitch(song.scale, song.gridSize, rowOf(col)).midi;
  expect(midi(0)).toBe(48); // C3
  expect(midi(6)).toBe(43); // G2
  expect(midi(13)).toBe(46); // Bb2
});

test('every named note in every example is in its scale (no silent snapping)', () => {
  const offsets: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  for (const spec of RAW_SPECS) {
    const size = spec.size ?? 16;
    const reachable = new Set(Array.from({ length: size }, (_, row) => getRowPitch(spec.scale, size, row).midi));
    for (const t of spec.tracks) {
      for (const tok of parseSteps(t.steps)) {
        for (const n of tok === '.' ? [] : tok.split(',')) {
          const m = /^([A-G])(#|b)?(\d)$/.exec(n);
          if (!m) continue;
          const midi = 12 * (Number(m[3]) + 1) + offsets[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
          if (!reachable.has(midi)) throw new Error(`${spec.name}/${t.name}: ${n} is not available in ${spec.scale} on a ${size} grid`);
        }
      }
    }
  }
});

import { encodeWav } from '../src/lib/wav';

test('WAV encoder writes a valid 16-bit stereo header and clamps samples', () => {
  const wav = encodeWav([Float32Array.from([0, 1, -1, 2]), Float32Array.from([0.5, 0, 0, -2])], 44100);
  const text = (o: number, n: number) => String.fromCharCode(...wav.slice(o, o + n));
  const view = new DataView(wav.buffer);
  expect(text(0, 4)).toBe('RIFF');
  expect(text(8, 4)).toBe('WAVE');
  expect(view.getUint16(22, true)).toBe(2); // channels
  expect(view.getUint32(24, true)).toBe(44100);
  expect(view.getUint32(40, true)).toBe(4 * 2 * 2); // 4 frames, 2 channels, 2 bytes
  expect(wav.length).toBe(44 + 16);
  expect(view.getInt16(44 + 4, true)).toBe(32767); // channel 0 frame 1 = +1
  expect(view.getInt16(44 + 12, true)).toBe(32767); // clamped +2
  expect(view.getInt16(44 + 14, true)).toBe(-32768); // clamped -2
});

test('sanitize validates bitcrusher settings', () => {
  const s = sanitizeSong({ effects: { crusherBits: 99, crusherRate: -1, crusherEnabled: true }, tracks: [{}] });
  expect(s.effects.crusherBits).toBe(16);
  expect(s.effects.crusherRate).toBe(0.02);
  expect(s.effects.crusherEnabled).toBe(true);
});
