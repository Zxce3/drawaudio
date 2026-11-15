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
