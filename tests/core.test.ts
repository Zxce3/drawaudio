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

import { EXAMPLE_SONGS, RAW_SPECS, SPEC_STEP_COUNT } from '../src/lib/songs';

test('there are 10 valid example songs', () => {
  expect(EXAMPLE_SONGS.length).toBe(10);
  expect(new Set(EXAMPLE_SONGS.map((s) => s.id)).size).toBe(10);
  for (const spec of RAW_SPECS) {
    for (const t of spec.tracks) {
      const tokens = t.steps.trim().split(/\s+/);
      expect(tokens.length).toBe(SPEC_STEP_COUNT);
      for (const tok of tokens) if (tok !== '.') for (const n of tok.split(',')) expect(Number(n)).toBeGreaterThanOrEqual(0);
    }
  }
  for (const example of EXAMPLE_SONGS) {
    const song = example.create();
    expect(song.tracks.length).toBeGreaterThan(0);
    for (const track of song.tracks) expect(track.matrix.flat().some(Boolean)).toBe(true);
    // survives the same validation as shared links
    const clean = sanitizeSong(JSON.parse(JSON.stringify(toCompact(song))));
    expect(clean.scale).toBe(song.scale);
    expect(clean.tracks.length).toBe(song.tracks.length);
    expect(clean.tracks[0].matrix).toEqual(song.tracks[0].matrix);
    expect(clean.effects.delayMode).toBe(song.effects.delayMode);
  }
});
