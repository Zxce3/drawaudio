import { expect, test } from 'bun:test';
import { createSongFromSpec, describeSong, editSong, encodeShare, decodeShare, getExample, listExamples, loadSong, midiBytes, shareLink, songFromMidi, songToSteps } from '../mcp/tools';

const spec = {
  name: 'T', tempo: 100, scale: 'Minor', size: 32 as const,
  tracks: [{ name: 'Lead', steps: ['C4 . E4 . G4 . . .', 'A3 . . . C4,E4 . . .'], sound: 'Pluck' }, { name: 'Bass', steps: 'C2 . . . G2', sound: 'Bass' }]
};

test('create_song builds a valid song with notes', () => {
  const song = createSongFromSpec(spec);
  expect(song.gridSize).toBe(32);
  expect(song.tracks.length).toBe(2);
  expect(describeSong(song).tracks[0].notes).toBeGreaterThan(3);
});

test('rejects unknown scale and preset, and over-long bars', () => {
  expect(() => createSongFromSpec({ ...spec, scale: 'Nope' })).toThrow();
  expect(() => createSongFromSpec({ ...spec, tracks: [{ name: 'a', steps: '.', sound: 'Nope' }] })).toThrow();
  expect(() => createSongFromSpec({ ...spec, tracks: [{ name: 'a', steps: Array(17).fill('C4').join(' ') }] })).toThrow();
});

test('share link round-trips and matches the browser format', async () => {
  const song = createSongFromSpec(spec);
  const hash = encodeShare(song);
  const decoded = decodeShare(hash);
  expect(decoded.tracks.map((t) => t.matrix)).toEqual(song.tracks.map((t) => t.matrix));
  expect(decoded.effects).toEqual(song.effects);
  const viaLink = await loadSong({ share_link: await shareLink(song) });
  expect(viaLink.tracks[0].matrix).toEqual(song.tracks[0].matrix);
  // The web app decodes with DecompressionStream('deflate-raw'): make sure zlib output is accepted by it
  if (typeof DecompressionStream !== 'undefined') {
    const bytes = Uint8Array.from(atob(hash.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (hash.length % 4)) % 4)), (c) => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    expect(JSON.parse(await new Response(stream).text()).name).toBe('T');
  }
});

test('steps from describe_song can be fed back to create_song', () => {
  const song = createSongFromSpec(spec);
  const again = createSongFromSpec({ ...spec, tracks: songToSteps(song).map((t) => ({ name: t.name, steps: t.steps })) });
  expect(again.tracks[0].matrix).toEqual(song.tracks[0].matrix);
});

test('edit_song clamps values and patches a track sound', () => {
  const song = createSongFromSpec(spec);
  const next = editSong(song, { tempo: 9999, effects: { reverbMix: 0.5 }, tracks: [{ index: 0, sound: { cutoff: 2000 } }] });
  expect(next.tempo).toBe(240);
  expect(next.effects.reverbMix).toBe(0.5);
  expect(next.tracks[0].params.cutoff).toBe(2000);
  expect(() => editSong(song, { tracks: [{ index: 9 }] })).toThrow();
});

test('examples, MIDI export and import', () => {
  expect(listExamples().length).toBe(21);
  const song = getExample('first-light');
  const back = songFromMidi(midiBytes(song), 'x.mid', song.scale);
  expect(back.tracks.length).toBe(song.tracks.length);
  expect(() => getExample('nope')).toThrow();
});
