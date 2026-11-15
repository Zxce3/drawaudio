export interface TourStep {
  title: string;
  text: string;
  /** Value of the data-guide attribute to highlight; omit for a centred card */
  target?: string;
  /** Side panel tab to open for this step */
  tab?: 'sequencer' | 'sound' | 'effects' | 'tools' | 'song';
}

export const TOUR: TourStep[] = [
  {
    title: 'Welcome to DrawAudio',
    text: 'Draw notes on a grid and hear them as music. This one-minute tour shows every part of the app. Use the arrow keys or the buttons to move through it, and Esc to leave at any time.'
  },
  {
    target: 'grid',
    title: 'The grid is your instrument',
    text: 'Click or drag to place notes; right-click erases. Columns are time and rows are pitch, with the highest notes at the top. The labels on the left show the note names. You can also use the arrow keys, Enter and Delete when the grid is focused.'
  },
  {
    target: 'play',
    title: 'Play and stop',
    text: 'Press Play (or Space) to hear your song. The yellow column is the playhead moving through time. Press R to record what you hear to a WAV file.'
  },
  {
    target: 'tempo',
    title: 'Tempo',
    text: 'Set the speed in beats per minute. Drag the slider, or tap the Tap button along with a beat. The - and = keys nudge it too.'
  },
  {
    target: 'gridsize',
    title: 'Grid size and bars',
    text: 'Choose 8×8 up to 64×64. A bigger grid means a longer song: 16 columns is one bar, 64 is four. The second menu sets how many beats make a bar.'
  },
  {
    target: 'scale',
    title: 'Scale',
    text: 'Every row is a note of the chosen scale, so whatever you draw sounds in key. Try the arrows to flip through major, minor, blues, Japanese and more.'
  },
  {
    target: 'tracks',
    title: 'Tracks',
    text: 'Layer up to eight instruments. Click a track to edit it, M mutes, S solos, and the sliders set volume, pan and reverb send. Other tracks appear as faint ghost notes in the grid.'
  },
  {
    target: 'tabs',
    title: 'The control panel',
    text: 'Five tabs shape your music. The little ? icons beside every setting explain it in plain words, so you never have to guess.',
    tab: 'sequencer'
  },
  {
    target: 'panel',
    title: 'Seq: how notes are played',
    text: 'Pick a waveform and playback direction, set note length, add swing, ratchets and glide, humanize the timing, or turn single notes into arpeggios and chords.',
    tab: 'sequencer'
  },
  {
    target: 'panel',
    title: 'Sound: design your instrument',
    text: 'Choose a preset, shape the volume envelope, filter the tone, thicken it with unison, FM and a sub oscillator, or play a morphing wavetable. The graphs update as you change things.',
    tab: 'sound'
  },
  {
    target: 'panel',
    title: 'FX: add space and character',
    text: 'Reverb, echoes (including reverse and pitch-shifted ones), distortion, bitcrusher, chorus, ring mod, sidechain pumping, tape and vinyl, and an equalizer. Each effect has an on/off switch.',
    tab: 'effects'
  },
  {
    target: 'panel',
    title: 'Tools: edit faster',
    text: 'Switch between draw and erase, generate a random melody, transpose a track, and choose the visualizer that dances behind the grid.',
    tab: 'tools'
  },
  {
    target: 'panel',
    title: 'Song: keep and share',
    text: 'Load one of 20 example songs, save your own, copy a share link, export or import MIDI, or render a loop to WAV. Your work also autosaves in this browser.',
    tab: 'song'
  },
  {
    target: 'about',
    title: 'Help is always here',
    text: 'Press ? for the shortcut list and credits, H to replay this guide, and click any ? icon for a quick explanation. Now go draw something!',
    tab: 'sequencer'
  }
];
