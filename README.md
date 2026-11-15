# DrawAudio

An interactive audio sequencer where you can create music by drawing patterns on a grid. Built with Svelte and Web Audio API.

> **Note:** 
> This project requires technical improvements and may have bugs. Contributions and fixes are welcome through pull requests.


> **Inspiration:** This project is inspired by [draw.audio](https://draw.audio/)

## Features

- **Piano-roll grid** (8×8 to 64×64) on a canvas: drag to draw, right-click to erase, note-name labels, beat and bar lines, keyboard control
- **Multiple tracks** with mute, solo, volume, pan and reverb send; other tracks show as ghost notes
- **Synth per track**: sine, triangle, saw, square and pulse waves, ADSR, filter, sub oscillator, noise, unison, FM and sound presets
- **Effects**: delay, convolution reverb (plate, guitar cabinet, drum room), distortion, chorus and a 3-band EQ
- **Transport**: tempo with tap tempo, time signatures, scales with prev/next, playback direction, undo and redo
- **Tools**: random melody generator and transpose
- **Recording**: press R to record to WAV, or render one clean loop; plus a bitcrusher effect
- **Installable and offline**: a PWA with a service worker, so it loads instantly and works without a connection
- **Guide and help**: a step-by-step guided tour (Guide button or H) and a `?` explanation next to every control
- **Shortcuts**: Space, R, D/E, 1-8, M/S, [ ], - =, V, Ctrl+S and more (press ? in the app)
- **Songs**: autosave, saved songs in the browser, shareable links and MIDI import/export
- Built with SvelteKit, Svelte 5 runes, Tailwind CSS 4 and shadcn-svelte

## Getting Started

1. Clone the repository
2. Install dependencies:

```bash
bun install
```

3. Start the development server:

```bash
bun run dev
```

4. Open your browser to the displayed URL (usually http://localhost:5173)

## Building for Production

```bash
bun run build
```

You can preview the production build with `bun run preview`.

## Audio Impulse Responses

To generate custom impulse responses:

```bash
bun run generate-impulse
```

## Technical Overview

DrawAudio uses the Web Audio API to generate sounds in real-time based on the visual grid pattern. The main components:

- `AudioService`: Handles all audio processing, note generation, and effects
- Interactive grid UI built with Svelte
- Tailwind CSS for styling

## License

MIT

## Credits

Inspired by [draw.audio](https://draw.audio/) and [svelte-audio-visualizations](https://github.com/flo-bit/svelte-audio-visualizations) (MIT). The bitcrusher and WAV recorder follow the AudioWorklet patterns from [web-audio-samples](https://github.com/GoogleChromeLabs/web-audio-samples) (Apache-2.0).
