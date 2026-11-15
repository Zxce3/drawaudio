<script lang="ts">
  import { Play, Square, Eraser, Undo2, Redo2, ChevronLeft, ChevronRight, Music, Info, Circle, BookOpen, Download, WifiOff, LoaderCircle } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Slider } from '$lib/components/ui/slider';
  import { Separator } from '$lib/components/ui/separator';
  import Choice from './Choice.svelte';
  import IconButton from './IconButton.svelte';
  import AboutDialog from './AboutDialog.svelte';
  import HelpTip from './HelpTip.svelte';
  import { pwa, install } from '$lib/pwa.svelte';
  import {
    song, ui, clearTrack, commit, undo, redo, togglePlay, toggleRecording, setGridSize, stepScale, tapTempo, scaleNames, getEngine
  } from '$lib/song.svelte';
  import { scaleLabel } from '$lib/scales';
  import { GRID_SIZES, TIME_SIGNATURES } from '$lib/types';

  const sizeOptions = GRID_SIZES.map((s) => ({ value: String(s), label: `${s}×${s}` }));
  const sigOptions = TIME_SIGNATURES.map((n) => ({ value: String(n), label: `${n}/4` }));
  const scaleOptions = scaleNames.map((n) => ({ value: n, label: scaleLabel(n) }));

  const position = $derived.by(() => {
    const perBar = 4 * song.beatsPerBar;
    const n = ui.playing ? Math.max(0, ui.stepsPlayed - 1) : 0;
    return `${Math.floor(n / perBar) + 1}.${Math.floor((n % perBar) / 4) + 1}.${(n % 4) + 1}`;
  });
  const time = $derived(`${Math.floor(ui.elapsed / 60)}:${(ui.elapsed % 60).toFixed(1).padStart(4, '0')}`);

  let level = $state(0);
  $effect(() => {
    if (!ui.playing) {
      level = 0;
      return;
    }
    let raf = 0;
    const tick = () => {
      level = level * 0.8 + getEngine().getLevel() * 0.2;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  let tempo = $state([song.tempo]);
  $effect(() => {
    if (tempo[0] !== song.tempo) tempo = [song.tempo];
  });
</script>

<header class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-2">
  <div class="flex items-center gap-2 pr-1">
    <Music class="text-primary size-5" />
    <h1 class="text-lg font-semibold tracking-tight">Draw<span class="text-primary">Audio</span><span class="sr-only"> – free online music maker and step sequencer</span></h1>
  </div>

  <dl class="bg-card hidden gap-4 rounded-md border px-3 py-1 font-mono text-xs md:flex" aria-label="Playback position" data-guide="position">
    <div><dt class="text-muted-foreground text-[10px] uppercase">Position</dt><dd class="tabular-nums">{position}</dd></div>
    <div><dt class="text-muted-foreground text-[10px] uppercase">Time</dt><dd class="tabular-nums">{time}</dd></div>
    <div><dt class="text-muted-foreground text-[10px] uppercase">Level</dt>
      <dd class="bg-muted mt-1.5 h-1.5 w-14 overflow-hidden rounded-full"><div class="bg-primary h-full" style="width: {Math.min(100, level * 140)}%"></div></dd>
    </div>
  </dl>

  <div class="flex items-center gap-1">
    <Button data-guide="play" onclick={togglePlay} variant={ui.playing ? 'secondary' : 'default'} class="w-24 gap-2" aria-keyshortcuts="Space">
      {#if ui.audioLoading}<LoaderCircle class="size-4 animate-spin" /> Loading{:else if ui.playing}<Square class="size-4" /> Stop{:else}<Play class="size-4" /> Play{/if}
    </Button>
    <IconButton icon={Circle} label={ui.recording ? 'Stop recording and save WAV (R)' : 'Record to WAV (R)'} onclick={toggleRecording} guide="record" pressed={ui.recording} disabled={ui.rendering} />
    {#if ui.recording}
      <span class="text-destructive font-mono text-xs tabular-nums" role="timer" aria-label="Recording time">● {ui.recordSeconds.toFixed(1)}s</span>
    {/if}
    <IconButton icon={Eraser} label="Clear active track (C)" onclick={clearTrack} />
    <IconButton icon={Undo2} label="Undo (Ctrl+Z)" onclick={undo} disabled={!ui.canUndo} />
    <IconButton icon={Redo2} label="Redo (Ctrl+Shift+Z)" onclick={redo} disabled={!ui.canRedo} />
  </div>

  <Separator orientation="vertical" class="hidden h-6 lg:block" />

  <div class="flex items-center gap-2" data-guide="gridsize">
    <Choice label="Grid size" class="w-24" value={String(song.gridSize)} options={sizeOptions} onchange={(v) => setGridSize(Number(v))} />
    <Choice label="Time signature" class="w-20" value={String(song.beatsPerBar)} options={sigOptions} onchange={(v) => { song.beatsPerBar = Number(v); commit(); }} />
    <HelpTip id="bar/gridSize" label="Grid size" />
  </div>

  <div class="flex min-w-48 items-center gap-3" data-guide="tempo">
    <Button variant="outline" size="sm" onclick={tapTempo}>Tap</Button>
    <Slider type="single" bind:value={tempo[0]} min={30} max={240} step={1} aria-label="Tempo"
      onValueChange={(v) => (song.tempo = v)} onValueCommit={commit} class="w-28" />
    <span class="w-14 font-mono text-sm tabular-nums">{song.tempo} <span class="text-muted-foreground text-xs">bpm</span></span>
    <HelpTip id="bar/tempo" label="Tempo" />
  </div>

  <div class="flex items-center gap-1" data-guide="scale">
    <IconButton icon={ChevronLeft} label="Previous scale" onclick={() => stepScale(-1)} />
    <Choice label="Scale" class="w-44" value={song.scale} options={scaleOptions} onchange={(v) => { song.scale = v; commit(); }} />
    <IconButton icon={ChevronRight} label="Next scale" onclick={() => stepScale(1)} />
    <HelpTip id="bar/scale" label="Scale" />
  </div>

  <div class="ml-auto flex items-center gap-1">
    {#if !pwa.online}
      <span class="text-muted-foreground bg-card flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs" role="status">
        <WifiOff class="size-3.5" /> Offline
      </span>
    {/if}
    {#if pwa.canInstall}
      <Button variant="outline" size="sm" class="gap-1.5" onclick={install}><Download class="size-4" /> Install</Button>
    {/if}
    <Button variant="outline" size="sm" class="gap-1.5" onclick={() => (ui.tourOpen = true)} data-guide="guide" aria-keyshortcuts="H">
      <BookOpen class="size-4" /> Guide
    </Button>
    <IconButton guide="about" icon={Info} label="About and shortcuts (?)" onclick={() => (ui.aboutOpen = true)} />
  </div>
</header>
<AboutDialog bind:open={ui.aboutOpen} />
{#if ui.audioError}
  <p role="alert" class="bg-destructive/20 text-destructive px-3 py-1.5 text-sm">Audio could not start: {ui.audioError}</p>
{/if}
