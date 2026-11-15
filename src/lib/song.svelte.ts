import { AudioEngine } from './audio';
import { SCALES } from './scales';
import {
  GRID_SIZES,
  SOUND_PRESETS,
  DEFAULT_SOUND,
  createSong,
  createTrack,
  emptyMatrix,
  type Track
} from './types';
import type { Song } from './types';
import { saveSong } from './storage';
import { exportMidi } from './midi';

export const song: Song = $state(createSong());

export const ui = $state({
  playing: false,
  step: -1,
  stepsPlayed: 0,
  elapsed: 0,
  tool: 'draw' as 'draw' | 'erase',
  canUndo: false,
  canRedo: false,
  audioError: '',
  audioLoading: false,
  aboutOpen: false,
  tourOpen: false,
  tourPrompt: false,
  panelTab: 'sequencer',
  recording: false,
  recordSeconds: 0,
  rendering: false,
  toast: '',
  songId: undefined as string | undefined,
  vizStyle: 'bars' as VizStyle,
  vizOpacity: 0.14
});

export type VizStyle = 'off' | 'bars' | 'circle' | 'wave' | 'glow';
export const VIZ_STYLES: VizStyle[] = ['off', 'bars', 'circle', 'wave', 'glow'];

export const MAX_TRACKS = 8;
export const scaleNames = Object.keys(SCALES);

export function activeTrack(): Track {
  return song.tracks[Math.min(song.activeTrack, song.tracks.length - 1)];
}

// ---------------------------------------------------------------- history

const HISTORY_LIMIT = 100;
let history: string[] = [];
let cursor = -1;

function snapshot(): string {
  return JSON.stringify($state.snapshot(song));
}

function refreshHistoryFlags() {
  ui.canUndo = cursor > 0;
  ui.canRedo = cursor < history.length - 1;
}

/** Record the current song as an undo step (no-op if nothing changed) */
export function commit() {
  const now = snapshot();
  if (history[cursor] === now) return;
  history = history.slice(0, cursor + 1);
  history.push(now);
  if (history.length > HISTORY_LIMIT) history.shift();
  cursor = history.length - 1;
  refreshHistoryFlags();
}

function restore(index: number) {
  Object.assign(song, JSON.parse(history[index]));
  cursor = index;
  refreshHistoryFlags();
}

export function undo() {
  if (cursor > 0) restore(cursor - 1);
}

export function redo() {
  if (cursor < history.length - 1) restore(cursor + 1);
}

/** Replace the whole song (load, import, share link) and reset undo history */
export function replaceSong(next: Song, keepHistory = false) {
  Object.assign(song, next);
  if (!keepHistory) {
    history = [];
    cursor = -1;
  }
  commit();
}

commit();

// ------------------------------------------------------------------ edits

export function setCell(row: number, col: number, value: boolean) {
  const track = activeTrack();
  if (track.matrix[row]?.[col] === undefined) return false;
  if (track.matrix[row][col] === value) return false;
  track.matrix[row][col] = value;
  return true;
}

export function clearTrack() {
  const track = activeTrack();
  track.matrix = emptyMatrix(song.gridSize);
  commit();
}

export function setGridSize(size: number) {
  if (!GRID_SIZES.includes(size as (typeof GRID_SIZES)[number]) || size === song.gridSize) return;
  const old = song.gridSize;
  for (const track of song.tracks) {
    const next = emptyMatrix(size);
    // Keep pitch alignment: rows are anchored to the bottom (lowest note)
    for (let r = 0; r < old; r++) {
      const nr = r - old + size;
      if (nr < 0 || nr >= size) continue;
      for (let c = 0; c < Math.min(old, size); c++) next[nr][c] = track.matrix[r][c];
    }
    track.matrix = next;
  }
  song.gridSize = size;
  commit();
}

export function addTrack() {
  if (song.tracks.length >= MAX_TRACKS) return;
  const track = createTrack(song.gridSize, `Synth ${song.tracks.length + 1}`);
  song.tracks.push(track);
  song.activeTrack = song.tracks.length - 1;
  commit();
}

export function removeTrack(index: number) {
  if (song.tracks.length <= 1) return;
  song.tracks.splice(index, 1);
  song.activeTrack = Math.min(song.activeTrack, song.tracks.length - 1);
  commit();
}

export function applyPreset(name: string) {
  const preset = SOUND_PRESETS[name];
  if (!preset) return;
  activeTrack().params = { ...DEFAULT_SOUND, ...preset };
  commit();
}

export function stepScale(direction: 1 | -1) {
  const index = scaleNames.indexOf(song.scale);
  song.scale = scaleNames[(index + direction + scaleNames.length) % scaleNames.length];
  commit();
}

/** Shift every note of the active track up or down by one row */
export function transpose(direction: 1 | -1) {
  const track = activeTrack();
  const size = song.gridSize;
  const next = emptyMatrix(size);
  for (let r = 0; r < size; r++) {
    const nr = r - direction; // up = lower row index
    if (nr < 0 || nr >= size) continue;
    next[nr] = [...track.matrix[r]];
  }
  track.matrix = next;
  commit();
}

/** Fill the active track with a random melody using a random walk */
export function generatePattern(density: number) {
  const size = song.gridSize;
  const matrix = emptyMatrix(size);
  let row = Math.floor(size / 2);
  for (let col = 0; col < size; col++) {
    if (Math.random() > density) continue;
    row = Math.min(size - 1, Math.max(0, row + Math.round((Math.random() - 0.5) * Math.max(2, size / 4))));
    matrix[row][col] = true;
  }
  activeTrack().matrix = matrix;
  commit();
}

// -------------------------------------------------------------- tap tempo

let taps: number[] = [];

export function tapTempo() {
  const now = performance.now();
  if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
  taps.push(now);
  taps = taps.slice(-6);
  if (taps.length >= 2) {
    const intervals = taps.slice(1).map((t, i) => t - taps[i]);
    const average = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    song.tempo = Math.min(240, Math.max(30, Math.round(60000 / average)));
  }
}

// ---------------------------------------------------------------- playback

let engine: AudioEngine | null = null;

export function getEngine(): AudioEngine {
  if (!engine) {
    engine = new AudioEngine(song);
    engine.onStep((step) => {
      ui.step = step;
      ui.stepsPlayed += 1;
      ui.elapsed = engine?.elapsed ?? 0;
    });
  }
  return engine;
}

/** Start the audio engine (needs a user gesture) */
export async function ensureAudio(): Promise<boolean> {
  try {
    // Decoding the reverb impulses can take a moment on first use
    ui.audioLoading = !getEngine().initialized;
    await getEngine().initialize();
    ui.audioError = '';
    return true;
  } catch (error) {
    ui.audioError = error instanceof Error ? error.message : 'Audio could not be started';
    return false;
  } finally {
    ui.audioLoading = false;
  }
}

export async function play() {
  if (!(await ensureAudio())) return;
  ui.stepsPlayed = 0;
  ui.elapsed = 0;
  await getEngine().start();
  ui.playing = true;
}

export function stop() {
  engine?.stop();
  ui.playing = false;
  ui.step = -1;
}

export function togglePlay() {
  return ui.playing ? stop() : play();
}

export function previewCell(row: number) {
  if (engine?.initialized) engine.preview(activeTrack(), row);
}

export function disposeEngine() {
  engine?.dispose();
  engine = null;
  ui.playing = false;
  ui.step = -1;
}

// ------------------------------------------------------------ feedback toast

let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** Show a short message (also announced to screen readers) */
export function notify(message: string) {
  ui.toast = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (ui.toast = ''), 2600);
}

// ----------------------------------------------------------- files and saving

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const fileName = () => song.name.replace(/[^\w-]+/g, '_') || 'song';

export function saveCurrent() {
  try {
    ui.songId = saveSong($state.snapshot(song) as Song, ui.songId);
    notify(`Saved “${song.name}”`);
  } catch {
    notify('Could not save: browser storage is unavailable or full');
  }
}

export function exportMidiFile() {
  download(new Blob([exportMidi($state.snapshot(song) as Song) as BlobPart], { type: 'audio/midi' }), `${fileName()}.mid`);
  notify('MIDI file exported');
}

// ---------------------------------------------------------------- recording

let recordTimer: ReturnType<typeof setInterval> | undefined;

/** Start or stop capturing the output; stopping downloads a WAV file */
export async function toggleRecording() {
  if (ui.rendering) return;
  if (!ui.recording) {
    if (!(await ensureAudio())) return;
    if (!getEngine().startRecording()) {
      notify('Recording is not supported in this browser');
      return;
    }
    ui.recording = true;
    ui.recordSeconds = 0;
    const started = performance.now();
    recordTimer = setInterval(() => (ui.recordSeconds = (performance.now() - started) / 1000), 200);
    notify('Recording… press R to stop and save');
    return;
  }
  clearInterval(recordTimer);
  ui.recording = false;
  const wav = await getEngine().stopRecording();
  if (wav) {
    download(wav, `${fileName()}.wav`);
    notify('Saved WAV recording');
  } else {
    notify('Nothing was recorded');
  }
}

/** Play the song once from the start and save it as a WAV file, including the effect tails */
export async function renderLoop() {
  if (ui.rendering || ui.recording) return;
  if (!(await ensureAudio())) return;
  const engine = getEngine();
  if (!engine.canRecord) {
    notify('Recording is not supported in this browser');
    return;
  }
  ui.rendering = true;
  notify('Rendering one loop…');
  try {
    await play();
    engine.startRecording();
    const loop = (60 / song.tempo / 4) * song.gridSize;
    await new Promise((resolve) => setTimeout(resolve, (loop + 2.5) * 1000));
    stop();
    const wav = await engine.stopRecording();
    if (wav) {
      download(wav, `${fileName()}.wav`);
      notify('Loop rendered to WAV');
    }
  } finally {
    ui.rendering = false;
  }
}

// ------------------------------------------------------- track shortcuts

export function selectTrack(index: number) {
  if (index < 0 || index >= song.tracks.length) return;
  song.activeTrack = index;
  notify(`Track: ${song.tracks[index].name}`);
}

export function toggleMute() {
  const t = activeTrack();
  t.mute = !t.mute;
  commit();
  notify(`${t.name} ${t.mute ? 'muted' : 'unmuted'}`);
}

export function toggleSolo() {
  const t = activeTrack();
  t.solo = !t.solo;
  commit();
  notify(`${t.name} ${t.solo ? 'solo' : 'solo off'}`);
}

export function nudgeTempo(delta: number) {
  song.tempo = Math.min(240, Math.max(30, song.tempo + delta));
  commit();
  notify(`${song.tempo} bpm`);
}

export function cycleVisualizer() {
  ui.vizStyle = VIZ_STYLES[(VIZ_STYLES.indexOf(ui.vizStyle) + 1) % VIZ_STYLES.length];
  notify(`Visualizer: ${ui.vizStyle}`);
}
