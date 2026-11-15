<script lang="ts">
  import { onMount } from 'svelte';
  import Transport from '$lib/components/app/Transport.svelte';
  import Grid from '$lib/components/app/Grid.svelte';
  import SidePanel from '$lib/components/app/SidePanel.svelte';
  import TrackStrip from '$lib/components/app/TrackStrip.svelte';
  import { song, commit, undo, redo, togglePlay, getEngine, disposeEngine, replaceSong } from '$lib/song.svelte';
  import { decodeShare, sanitizeSong, toCompact } from '$lib/storage';
  import { updateSeo } from '$lib/seo';

  const AUTOSAVE_KEY = 'drawaudio:autosave';

  updateSeo({
    title: 'DrawAudio - Create Music by Drawing',
    description:
      'Draw notes on a grid to make music in your browser. Multi-track sequencer with synth sounds, effects, scales, MIDI export and shareable links.'
  });

  let ready = $state(false);

  onMount(() => {
    (async () => {
      try {
        const shared = location.hash.match(/^#s=(.+)$/)?.[1];
        if (shared) replaceSong(await decodeShare(shared));
        else {
          const saved = localStorage.getItem(AUTOSAVE_KEY);
          if (saved) replaceSong(sanitizeSong(JSON.parse(saved)));
        }
      } catch (error) {
        console.warn('Could not restore song:', error);
      }
      ready = true;
    })();
    return disposeEngine;
  });

  // Keep the audio graph in step with the song (mixer + effects)
  $effect(() => {
    song.tracks.map((t) => [t.id, t.volume, t.pan, t.reverbSend, t.mute, t.solo]);
    if (ready) getEngine().syncTracks();
  });
  $effect(() => {
    JSON.stringify(song.effects);
    song.tempo;
    if (ready) getEngine().applyEffects();
  });

  // Autosave, debounced
  $effect(() => {
    if (!ready) return;
    const data = JSON.stringify(toCompact($state.snapshot(song) as typeof song));
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, data);
      } catch {
        /* storage unavailable: autosave is best-effort */
      }
    }, 800);
    return () => clearTimeout(timer);
  });

  function onkeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [role="slider"], [role="combobox"], [role="tab"]')) return;
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
    } else if (mod && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      redo();
    } else if (event.code === 'Space' && !target?.closest('button, a')) {
      event.preventDefault();
      togglePlay();
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="flex h-dvh min-h-0 flex-col">
  <Transport />
  <main class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:flex-row lg:overflow-hidden">
    <Grid />
    <SidePanel />
  </main>
  <TrackStrip />
</div>
