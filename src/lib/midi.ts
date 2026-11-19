import { findRowForMidi, getRowPitch } from './scales';
import { GRID_SIZES, createTrack, emptyMatrix, heldSteps, type Song } from './types';

const PPQ = 480;
const STEP_TICKS = PPQ / 4; // one grid column = a sixteenth note

// ----------------------------------------------------------------- writing

function vlq(value: number): number[] {
  const bytes = [value & 0x7f];
  while ((value >>= 7) > 0) bytes.unshift((value & 0x7f) | 0x80);
  return bytes;
}

function u32(n: number): number[] {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

function chunk(type: string, body: number[]): number[] {
  return [...[...type].map((c) => c.charCodeAt(0)), ...u32(body.length), ...body];
}

function textBytes(text: string): number[] {
  return [...new TextEncoder().encode(text)];
}

/** Serialize a song as a Standard MIDI File (format 1, one track per song track) */
export function exportMidi(song: Song): Uint8Array {
  const microsPerQuarter = Math.round(60_000_000 / song.tempo);
  const tempoTrack = [
    0, 0xff, 0x03, ...vlq(textBytes(song.name).length), ...textBytes(song.name),
    0, 0xff, 0x51, 0x03, (microsPerQuarter >> 16) & 255, (microsPerQuarter >> 8) & 255, microsPerQuarter & 255,
    0, 0xff, 0x58, 0x04, song.beatsPerBar, 2, 24, 8,
    0, 0xff, 0x2f, 0x00
  ];

  const bodies = song.tracks.map((track, index) => {
    const channel = index < 9 ? index : Math.min(index + 1, 15); // channel 10 is drums
    const events: { tick: number; order: number; data: number[] }[] = [];
    for (let row = 0; row < song.gridSize; row++) {
      const midi = getRowPitch(song.scale, song.gridSize, row).midi;
      let col = 0;
      while (col < song.gridSize) {
        if (!track.matrix[row]?.[col]) {
          col++;
          continue;
        }
        // A note is one cell plus the cells tied to it, exactly as the audio engine plays it
        const start = col;
        col += heldSteps(track.ties ?? [], row, col);
        events.push({ tick: start * STEP_TICKS, order: 1, data: [0x90 | channel, midi, 96] });
        events.push({ tick: col * STEP_TICKS, order: 0, data: [0x80 | channel, midi, 0] });
      }
    }
    events.sort((a, b) => a.tick - b.tick || a.order - b.order);

    const name = textBytes(track.name);
    const out = [0, 0xff, 0x03, ...vlq(name.length), ...name];
    let last = 0;
    for (const event of events) {
      out.push(...vlq(event.tick - last), ...event.data);
      last = event.tick;
    }
    out.push(0, 0xff, 0x2f, 0x00);
    return out;
  });

  const header = chunk('MThd', [0, 1, ...[(bodies.length + 1) >> 8, (bodies.length + 1) & 255], PPQ >> 8, PPQ & 255]);
  return Uint8Array.from([...header, ...chunk('MTrk', tempoTrack), ...bodies.flatMap((b) => chunk('MTrk', b))]);
}

// ----------------------------------------------------------------- reading

export interface MidiNote {
  tick: number;
  duration: number;
  midi: number;
}

export interface ParsedMidi {
  ppq: number;
  tempo: number;
  beatsPerBar: number | null;
  tracks: { name: string; notes: MidiNote[] }[];
}

export function parseMidi(bytes: Uint8Array): ParsedMidi {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  const str = (n: number) => String.fromCharCode(...bytes.slice(pos, pos + n));
  const fail = (message: string): never => {
    throw new Error(`Invalid MIDI file: ${message}`);
  };

  if (bytes.length < 14 || str(4) !== 'MThd') fail('missing header');
  const trackCount = view.getUint16(10);
  const division = view.getUint16(12);
  if (division & 0x8000) fail('SMPTE timing is not supported');
  pos = 8 + view.getUint32(4);

  const result: ParsedMidi = { ppq: division, tempo: 120, beatsPerBar: null, tracks: [] };
  let sawTempo = false;

  for (let t = 0; t < trackCount && pos + 8 <= bytes.length; t++) {
    const id = str(4);
    const length = view.getUint32(pos + 4);
    pos += 8;
    const end = Math.min(pos + length, bytes.length);
    if (id !== 'MTrk') {
      pos = end;
      continue;
    }

    const track = { name: '', notes: [] as MidiNote[] };
    const open = new Map<number, number>(); // channel*128+note -> start tick
    let tick = 0;
    let status = 0;

    const readVlq = () => {
      let value = 0;
      for (let i = 0; i < 4 && pos < end; i++) {
        const byte = bytes[pos++];
        value = (value << 7) | (byte & 0x7f);
        if (!(byte & 0x80)) break;
      }
      return value;
    };

    while (pos < end) {
      tick += readVlq();
      let first = bytes[pos];
      if (first & 0x80) {
        status = first;
        pos++;
      } else {
        first = status; // running status: data byte follows
      }
      if (status === 0xff) {
        const type = bytes[pos++];
        const len = readVlq();
        const data = bytes.slice(pos, pos + len);
        pos += len;
        if (type === 0x03 && !track.name) track.name = new TextDecoder().decode(data);
        if (type === 0x51 && data.length === 3 && !sawTempo) {
          result.tempo = Math.round(60_000_000 / ((data[0] << 16) | (data[1] << 8) | data[2]));
          sawTempo = true;
        }
        if (type === 0x58 && data.length >= 2 && data[1] === 2 && result.beatsPerBar === null) {
          result.beatsPerBar = data[0];
        }
        if (type === 0x2f) break;
      } else if (status === 0xf0 || status === 0xf7) {
        pos += readVlq();
      } else {
        const kind = status & 0xf0;
        const channel = status & 0x0f;
        const size = kind === 0xc0 || kind === 0xd0 ? 1 : 2;
        const a = bytes[pos];
        const b = size === 2 ? bytes[pos + 1] : 0;
        pos += size;
        const key = channel * 128 + a;
        if (kind === 0x90 && b > 0) {
          open.set(key, tick);
        } else if (kind === 0x80 || (kind === 0x90 && b === 0)) {
          const start = open.get(key);
          if (start !== undefined) {
            track.notes.push({ tick: start, duration: Math.max(tick - start, 1), midi: a });
            open.delete(key);
          }
        }
      }
    }
    pos = end;
    if (track.notes.length) result.tracks.push(track);
  }
  return result;
}

/** Fit parsed MIDI notes onto the sequencer grid, replacing the song's tracks */
export function midiToSong(parsed: ParsedMidi, base: Song, fileName = 'Imported'): Song {
  const stepTicks = parsed.ppq / 4;
  const tracks = parsed.tracks.slice(0, 8);
  const lastCol = Math.max(0, ...tracks.flatMap((t) => t.notes.map((n) => Math.round(n.tick / stepTicks))));
  const gridSize = GRID_SIZES.find((s) => s > lastCol) ?? GRID_SIZES[GRID_SIZES.length - 1];

  const song: Song = {
    ...base,
    name: fileName.replace(/\.midi?$/i, '') || 'Imported',
    tempo: Math.min(240, Math.max(30, parsed.tempo)),
    beatsPerBar: parsed.beatsPerBar && parsed.beatsPerBar >= 2 && parsed.beatsPerBar <= 7 ? parsed.beatsPerBar : base.beatsPerBar,
    gridSize,
    activeTrack: 0,
    tracks: tracks.map((source, i) => {
      const track = createTrack(gridSize, source.name || `Synth ${i + 1}`);
      track.matrix = emptyMatrix(gridSize);
      track.ties = emptyMatrix(gridSize);
      for (const note of source.notes) {
        const col = Math.round(note.tick / stepTicks);
        if (col >= gridSize) continue;
        const row = findRowForMidi(base.scale, gridSize, note.midi);
        const length = Math.max(1, Math.round(note.duration / stepTicks));
        for (let c = col; c < Math.min(gridSize, col + length); c++) {
          track.matrix[row][c] = true;
          if (c > col) track.ties[row][c] = true;
        }
      }
      return track;
    })
  };
  if (!song.tracks.length) throw new Error('No notes found in this MIDI file');
  return song;
}
