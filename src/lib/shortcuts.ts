import {
  activeTrack, addTrack, clearTrack, cycleSkin, cycleVisualizer, exportMidiFile, generatePattern, nudgeTempo, redo,
  saveCurrent, selectTrack, song, stepScale, stop, tapTempo, toggleMute, toggleRecording, toggleSolo, togglePlay,
  transpose, ui, undo, notify
} from './song.svelte';
import { scaleLabel } from './scales';

export interface Shortcut {
  keys: string;
  description: string;
  group: 'Playback' | 'Editing' | 'Tracks' | 'Song' | 'View';
  /** Returns true if the event is this shortcut; `run` is then called */
  match: (e: KeyboardEvent) => boolean;
  run: (e: KeyboardEvent) => void;
  /** Also fire while a text field or button has focus (Ctrl shortcuts) */
  global?: boolean;
}

const key = (e: KeyboardEvent) => e.key.toLowerCase();
const plain = (e: KeyboardEvent) => !e.ctrlKey && !e.metaKey && !e.altKey;
const mod = (e: KeyboardEvent) => e.ctrlKey || e.metaKey;

export const SHORTCUTS: Shortcut[] = [
  { group: 'Playback', keys: 'Space', description: 'Play / stop', match: (e) => e.code === 'Space' && plain(e), run: () => togglePlay() },
  { group: 'Playback', keys: 'Home', description: 'Stop and return to the start', match: (e) => e.key === 'Home', run: () => stop() },
  { group: 'Playback', keys: 'R', description: 'Start / stop recording to WAV', match: (e) => key(e) === 'r' && plain(e), run: () => void toggleRecording() },
  { group: 'Playback', keys: '- / =', description: 'Tempo −1 / +1 (hold Shift for ±10)', match: (e) => plain(e) && ['-', '_', '=', '+'].includes(e.key), run: (e) => nudgeTempo((['-', '_'].includes(e.key) ? -1 : 1) * (e.shiftKey ? 10 : 1)) },
  { group: 'Playback', keys: 'T', description: 'Tap tempo', match: (e) => key(e) === 't' && plain(e), run: () => { tapTempo(); notify(`${song.tempo} bpm`); } },
  { group: 'Playback', keys: '[ / ]', description: 'Previous / next scale', match: (e) => plain(e) && (e.key === '[' || e.key === ']'), run: (e) => { stepScale(e.key === '[' ? -1 : 1); notify(`Scale: ${scaleLabel(song.scale)}`); } },

  { group: 'Editing', keys: 'Ctrl+Z', description: 'Undo', match: (e) => mod(e) && key(e) === 'z' && !e.shiftKey, run: () => undo(), global: true },
  { group: 'Editing', keys: 'Ctrl+Shift+Z / Ctrl+Y', description: 'Redo', match: (e) => mod(e) && ((key(e) === 'z' && e.shiftKey) || key(e) === 'y'), run: () => redo(), global: true },
  { group: 'Editing', keys: 'D / L / E', description: 'Draw tool / long-note tool / erase tool', match: (e) => plain(e) && ['d', 'l', 'e'].includes(key(e)), run: (e) => { ui.tool = ({ d: 'draw', l: 'hold', e: 'erase' } as const)[key(e) as 'd' | 'l' | 'e']; notify(`${{ draw: 'Draw', hold: 'Long note', erase: 'Erase' }[ui.tool]} tool`); } },
  { group: 'Editing', keys: 'Shift+↑ / Shift+↓', description: 'Transpose the active track', match: (e) => e.shiftKey && plain(e) && (e.key === 'ArrowUp' || e.key === 'ArrowDown'), run: (e) => transpose(e.key === 'ArrowUp' ? 1 : -1) },
  { group: 'Editing', keys: 'G', description: 'Generate a random melody', match: (e) => key(e) === 'g' && plain(e), run: () => { generatePattern(0.4); notify('Generated a melody (Ctrl+Z to undo)'); } },
  { group: 'Editing', keys: 'C', description: 'Clear the active track', match: (e) => key(e) === 'c' && plain(e), run: () => { clearTrack(); notify(`Cleared ${activeTrack().name} (Ctrl+Z to undo)`); } },

  { group: 'Tracks', keys: '1 – 8', description: 'Select a track', match: (e) => plain(e) && !e.shiftKey && /^[1-8]$/.test(e.key), run: (e) => selectTrack(Number(e.key) - 1) },
  { group: 'Tracks', keys: 'N', description: 'Add a track', match: (e) => key(e) === 'n' && plain(e), run: () => { addTrack(); notify('Added a track'); } },
  { group: 'Tracks', keys: 'M / S', description: 'Mute / solo the active track', match: (e) => plain(e) && (key(e) === 'm' || key(e) === 's'), run: (e) => (key(e) === 'm' ? toggleMute() : toggleSolo()) },

  { group: 'Song', keys: 'Ctrl+S', description: 'Save the song in this browser', match: (e) => mod(e) && key(e) === 's', run: () => saveCurrent(), global: true },
  { group: 'Song', keys: 'Ctrl+E', description: 'Export as a MIDI file', match: (e) => mod(e) && key(e) === 'e', run: () => exportMidiFile(), global: true },

  { group: 'View', keys: 'V', description: 'Cycle the visualizer style', match: (e) => key(e) === 'v' && plain(e), run: () => cycleVisualizer() },
  { group: 'View', keys: 'K', description: 'Next skin (colour theme)', match: (e) => key(e) === 'k' && plain(e), run: () => cycleSkin() },
  { group: 'View', keys: 'H', description: 'Start the guided tour', match: (e) => key(e) === 'h' && plain(e), run: () => (ui.tourOpen = true) },
  { group: 'View', keys: '? / F1', description: 'Show About and shortcuts', match: (e) => e.key === '?' || e.key === 'F1', run: () => (ui.aboutOpen = !ui.aboutOpen) }
];

/** Keys handled inside the grid itself, listed for the help screens */
export const GRID_SHORTCUTS: [string, string][] = [
  ['Arrow keys', 'Move the cursor in the grid'],
  ['Enter or X', 'Toggle a note at the cursor'],
  ['Shift+← / Shift+→', 'Shorten / lengthen the note at the cursor'],
  ['Delete', 'Erase the note at the cursor']
];

/** Route a keydown to a shortcut. Returns true if one ran. */
export function handleShortcut(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  // Fields that consume ordinary typing, and widgets that own their navigation keys
  const textual = !!target?.closest('input, textarea, select, [contenteditable], [role="combobox"], [role="dialog"]');
  const navigation = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key);
  // Tabs and sliders only use the navigation keys, so letters keep working after you click one
  const typing = textual || (!!target?.closest('[role="tab"], [role="slider"]') && navigation);
  const onButton = !!target?.closest('button, a');
  const gridFocused = target?.getAttribute('role') === 'application';

  for (const shortcut of SHORTCUTS) {
    if (!shortcut.match(event)) continue;
    const help = shortcut.keys === '? / F1';
    // In a text field, slider, menu or dialog only Ctrl shortcuts and help apply
    if (typing && !shortcut.global && !help) continue;
    // Space on a focused button should press it, not toggle playback
    if (onButton && event.code === 'Space') continue;
    // Inside the grid, plain arrows belong to the grid; Shift+arrows transpose
    if (gridFocused && !event.shiftKey && event.key.startsWith('Arrow')) continue;
    event.preventDefault();
    shortcut.run(event);
    return true;
  }
  return false;
}
