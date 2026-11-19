<script lang="ts">
  import { onMount } from 'svelte';
  import Transport from '$lib/components/app/Transport.svelte';
  import Grid from '$lib/components/app/Grid.svelte';
  import SidePanel from '$lib/components/app/SidePanel.svelte';
  import TrackStrip from '$lib/components/app/TrackStrip.svelte';
  import Toast from '$lib/components/app/Toast.svelte';
  import GuideTour from '$lib/components/app/GuideTour.svelte';
  import { song, ui, getEngine, disposeEngine, replaceSong, notify } from '$lib/song.svelte';
  import { handleShortcut } from '$lib/shortcuts';
  import { decodeShare, sanitizeSong, toCompact } from '$lib/storage';
  import { EXAMPLE_SONGS } from '$lib/songs';
  import { base } from '$app/paths';
  import Seo from '$lib/components/Seo.svelte';
  import { HOME_TITLE, HOME_DESCRIPTION, FEATURES, webApplicationLd, websiteLd } from '$lib/seo';

  const AUTOSAVE_KEY = 'drawaudio:autosave';
  const VIZ_KEY = 'drawaudio:viz2';

  let ready = $state(false);

  onMount(() => {
    // Visualizer preferences are per browser, not part of a song
    try {
      const prefs = JSON.parse(localStorage.getItem(VIZ_KEY) ?? 'null');
      if (prefs && ['off', 'bars', 'circle', 'wave', 'glow'].includes(prefs.style)) {
        ui.vizStyle = prefs.style;
        if (typeof prefs.opacity === 'number') ui.vizOpacity = Math.min(0.6, Math.max(0.03, prefs.opacity));
      } else if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        ui.vizStyle = 'off';
      }
    } catch {
      /* ignore unreadable preferences */
    }
    (async () => {
      try {
        const shared = location.hash.match(/^#s=(.+)$/)?.[1];
        const example = EXAMPLE_SONGS.find((e) => e.id === new URLSearchParams(location.search).get('song'));
        if (shared) replaceSong(await decodeShare(shared));
        else if (example) {
          // Arrived from an example page: open that song, and keep the address clean
          replaceSong(example.create());
          history.replaceState(null, '', location.pathname);
        } else {
          const saved = localStorage.getItem(AUTOSAVE_KEY);
          // First visit: start with an example so there is something to hear
          replaceSong(saved ? sanitizeSong(JSON.parse(saved)) : EXAMPLE_SONGS[0].create());
        }
      } catch (error) {
        console.warn('Could not restore song:', error);
        // A share link that was copied incompletely or altered cannot be decoded: say so instead of showing an empty grid
        if (/^#s=/.test(location.hash)) notify('This share link is damaged or cut off, so the song could not be opened. Ask for the link again.', 9000);
      }
      ready = true;
    })();
    return disposeEngine;
  });

  // Dismiss the loading screen (see app.html) once the saved song is in place
  $effect(() => {
    if (!ready) return;
    requestAnimationFrame(() => {
      const splash = document.getElementById('splash');
      if (!splash) return;
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 450);
    });
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

  $effect(() => {
    const prefs = JSON.stringify({ style: ui.vizStyle, opacity: ui.vizOpacity });
    if (!ready) return;
    try {
      localStorage.setItem(VIZ_KEY, prefs);
    } catch {
      /* best effort */
    }
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

  const onkeydown = handleShortcut;
</script>

<Seo title={HOME_TITLE} description={HOME_DESCRIPTION} path="/" jsonLd={[webApplicationLd(), websiteLd()]} />

<svelte:window {onkeydown} />

<div class="flex h-dvh min-h-0 flex-col">
  <Transport />
  <main class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:flex-row lg:overflow-hidden">
    <Grid />
    <SidePanel />
  </main>
  <TrackStrip />
</div>
<Toast />
<GuideTour />

<!-- Plain-language description for search engines and screen-reader users (the app itself is a canvas and controls) -->
<aside class="sr-only" aria-labelledby="about-heading">
  <h2 id="about-heading">About DrawAudio</h2>
  <p>
    DrawAudio is a free online music maker and step sequencer. Draw notes on a grid and the app plays them back as a song with a built-in multi-track
    synthesizer. It runs entirely in your browser, works offline once loaded, and needs no account.
  </p>
  <h2>What you can do</h2>
  <ul>
    {#each FEATURES as feature}
      <li>{feature}</li>
    {/each}
  </ul>
  <h2>Example songs</h2>
  <p>
    Browse the <a href="{base}/examples/">21 example songs</a> for ideas: lo-fi, synthwave, chiptune, ambient and more, each one opens in the editor.
  </p>
</aside>
