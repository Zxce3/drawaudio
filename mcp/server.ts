#!/usr/bin/env bun
// DrawAudio MCP server (stdio). Lets an AI agent compose, edit, validate and share DrawAudio songs.
// It runs the same validation code as the web app; audio is played by opening the share link in a browser.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { z } from 'zod';
import * as t from './tools';

const server = new McpServer({ name: 'drawaudio', version: '0.1.0' });

const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] });
const fail = (error: unknown) => ({ isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }] });
const run = (fn: () => Promise<unknown> | unknown) => Promise.resolve().then(fn).then(text, fail);

/** Every song result includes a summary, a link that plays it in the app, and the compact JSON for follow-up calls */
async function songResult(song: Parameters<typeof t.describeSong>[0]) {
  return { link: await t.shareLink(song), summary: t.describeSong(song), song: t.toCompact(song) };
}

const songInput = {
  song: z.any().optional().describe('Compact song JSON returned by another DrawAudio tool'),
  share_link: z.string().optional().describe('A drawaudio.zxce3.net share link (or just the part after #s=)')
};

const trackSchema = z.object({
  name: z.string().max(40),
  steps: z.union([z.string(), z.array(z.string())]).describe(
    'One string per bar of 16 steps (a single string is one bar; short bars are padded with rests). Space-separated tokens: "." rest, a note name like "Eb4" or "C#3" (snapped to the song scale), a number = pitch index up from the lowest row, "C4,E4,G4" = several notes at once. Append ~ to hold a note from the previous step ("C4 C4~ C4~ C4~" is one note lasting 4 steps); "-" holds every note of the previous step ("C4 - - -"). Without ~ or -, neighbouring steps are separate notes.'
  ),
  sound: z.string().optional().describe('Preset name from list_presets'),
  sound_overrides: z.record(z.string(), z.any()).optional().describe('Sound parameters from get_param_schema.trackSound'),
  volume: z.number().min(0).max(1).optional(),
  pan: z.number().min(-1).max(1).optional(),
  reverb: z.number().min(0).max(1).optional()
});

server.registerTool('list_examples', { description: 'List the 21 built-in example songs.', inputSchema: {} }, () => run(t.listExamples));
server.registerTool('get_example', { description: 'Load an example song by id (see list_examples).', inputSchema: { id: z.string() } }, ({ id }) => run(async () => songResult(t.getExample(id))));
server.registerTool('list_scales', { description: 'The 18 scales a song can use.', inputSchema: {} }, () => run(t.listScales));
server.registerTool('list_presets', { description: 'Sound presets for tracks.', inputSchema: {} }, () => run(t.listPresets));
server.registerTool('get_param_schema', { description: 'Every valid sound and effect parameter with ranges, choices and defaults. Read this before setting sound_overrides or effects.', inputSchema: {} }, () => run(t.paramSchema));

server.registerTool('create_song', {
  description: 'Compose a new song. Rows are scale degrees, so any note in the chosen scale sounds in key. Returns a share link that opens the song in DrawAudio, a text summary and the compact JSON.',
  inputSchema: {
    name: z.string().max(60),
    tempo: z.number().min(30).max(240).optional().describe('bpm, default 90'),
    scale: z.string().optional().describe('From list_scales, default Pentatonic'),
    size: z.union([z.literal(16), z.literal(32), z.literal(64)]).optional().describe('Steps: 16 = 1 bar, 32 = 2 bars, 64 = 4 bars. Default 16'),
    swing: z.number().min(0.25).max(0.75).optional(),
    effects: z.record(z.string(), z.any()).optional().describe('Effect parameters from get_param_schema.effects'),
    tracks: z.array(trackSchema).min(1).max(8)
  }
}, (input) => run(async () => songResult(t.createSongFromSpec(input as t.CreateInput))));

server.registerTool('edit_song', {
  description: 'Change song-level settings, effects, mixer values or a track sound without redrawing notes. To change notes, call create_song again with new steps.',
  inputSchema: {
    ...songInput,
    patch: z.object({
      name: z.string().optional(), tempo: z.number().optional(), scale: z.string().optional(), swing: z.number().optional(),
      humanizeTiming: z.number().optional(), humanizeVelocity: z.number().optional(), pattern: z.string().optional(),
      effects: z.record(z.string(), z.any()).optional(),
      tracks: z.array(z.object({
        index: z.number().int().min(0), name: z.string().optional(), volume: z.number().optional(), pan: z.number().optional(),
        reverbSend: z.number().optional(), mute: z.boolean().optional(), solo: z.boolean().optional(), sound: z.record(z.string(), z.any()).optional()
      })).optional()
    })
  }
}, ({ song, share_link, patch }) => run(async () => songResult(t.editSong(await t.loadSong({ song, share_link }), patch as t.EditInput))));

server.registerTool('describe_song', {
  description: 'Summarize a song and show every track as note-name steps (the same format create_song accepts), so you can read, reason about and rewrite it.',
  inputSchema: songInput
}, (input) => run(async () => songResult(await t.loadSong(input))));

server.registerTool('make_share_link', {
  description: 'Get a link that opens the song in DrawAudio in the browser. The song is in the URL fragment: nothing is uploaded.',
  inputSchema: songInput
}, (input) => run(async () => t.shareLink(await t.loadSong(input))));

server.registerTool('export_midi', {
  description: 'Export a song as a Standard MIDI File. Provide output_path (must end in .mid) to save it, otherwise the bytes are returned as base64.',
  inputSchema: { ...songInput, output_path: z.string().optional() }
}, ({ song, share_link, output_path }) => run(async () => {
  const bytes = t.midiBytes(await t.loadSong({ song, share_link }));
  if (output_path) {
    if (extname(output_path).toLowerCase() !== '.mid') throw new Error('output_path must end in .mid');
    const path = resolve(output_path);
    await writeFile(path, bytes);
    return { saved: path, bytes: bytes.length };
  }
  return { base64: Buffer.from(bytes).toString('base64'), bytes: bytes.length };
}));

server.registerTool('import_midi', {
  description: 'Turn a MIDI file into a DrawAudio song: notes snap to sixteenth steps and to the nearest pitch of the scale, max 8 tracks.',
  inputSchema: {
    path: z.string().optional().describe('Path to a .mid file'),
    base64: z.string().optional(),
    scale: z.string().optional().describe('Scale to snap to, default Chromatic')
  }
}, ({ path, base64, scale }) => run(async () => {
  let bytes: Uint8Array;
  let name = 'Imported';
  if (path) {
    if (!/\.midi?$/i.test(path)) throw new Error('path must be a .mid or .midi file');
    bytes = new Uint8Array(await readFile(resolve(path)));
    name = path.split('/').pop() ?? name;
  } else if (base64) bytes = new Uint8Array(Buffer.from(base64, 'base64'));
  else throw new Error('Pass `path` or `base64`.');
  return songResult(t.songFromMidi(bytes, name, scale));
}));

await server.connect(new StdioServerTransport());
