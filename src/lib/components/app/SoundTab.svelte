<script lang="ts">
  import Choice from './Choice.svelte';
  import ParamSlider from './ParamSlider.svelte';
  import { Label } from '$lib/components/ui/label';
  import { song, activeTrack, applyPreset, commit } from '$lib/song.svelte';
  import { SOUND_PRESETS, type Waveform } from '$lib/types';

  const track = $derived(activeTrack());
  const p = $derived(track.params);
  const presets = Object.keys(SOUND_PRESETS).map((n) => ({ value: n, label: n }));
  const waves = (['sine', 'triangle', 'sawtooth', 'square', 'pulse'] as const).map((w) => ({ value: w, label: w[0].toUpperCase() + w.slice(1) }));
  const sec = (v: number) => `${v.toFixed(2)} s`;
</script>

<div class="space-y-5">
  <p class="text-muted-foreground text-xs">Editing <strong class="text-foreground">{track.name}</strong></p>

  <div class="grid grid-cols-2 gap-3">
    <div class="space-y-1.5">
      <Label class="text-muted-foreground text-xs">Preset</Label>
      <Choice label="Preset" class="w-full" value="" options={presets} onchange={applyPreset} />
    </div>
    <div class="space-y-1.5">
      <Label class="text-muted-foreground text-xs">Waveform</Label>
      <Choice label="Waveform" class="w-full" value={p.waveform} options={waves} onchange={(v) => { p.waveform = v as Waveform; commit(); }} />
    </div>
  </div>

  {#if p.waveform === 'pulse'}
    <ParamSlider label="Pulse width" bind:value={p.pulseWidth} min={0.05} max={0.95} format={(v) => `${Math.round(v * 100)}%`} oncommit={commit} />
  {/if}

  <section class="space-y-3">
    <h3 class="text-sm font-medium">Envelope</h3>
    <ParamSlider label="Attack" bind:value={p.attack} min={0} max={1} format={sec} oncommit={commit} />
    <ParamSlider label="Decay" bind:value={p.decay} min={0} max={1} format={sec} oncommit={commit} />
    <ParamSlider label="Sustain" bind:value={p.sustain} min={0} max={1} format={(v) => `${Math.round(v * 100)}%`} oncommit={commit} />
    <ParamSlider label="Release" bind:value={p.release} min={0} max={2} format={sec} oncommit={commit} />
    <ParamSlider label="Gate (note length)" bind:value={p.gate} min={0.1} max={1} format={(v) => `${Math.round(v * 100)}%`} oncommit={commit} />
  </section>

  <section class="space-y-3">
    <h3 class="text-sm font-medium">Filter</h3>
    <ParamSlider label="Cutoff" bind:value={p.cutoff} min={200} max={12000} step={50} format={(v) => `${Math.round(v)} Hz`} oncommit={commit} />
    <ParamSlider label="Resonance" bind:value={p.resonance} min={0} max={15} step={0.1} format={(v) => v.toFixed(1)} oncommit={commit} />
  </section>

  <section class="space-y-3">
    <h3 class="text-sm font-medium">Oscillator</h3>
    <ParamSlider label="Sub oscillator" bind:value={p.subLevel} min={0} max={1} format={(v) => `${Math.round(v * 100)}%`} oncommit={commit} />
    <ParamSlider label="Noise" bind:value={p.noiseLevel} min={0} max={1} format={(v) => `${Math.round(v * 100)}%`} oncommit={commit} />
    <ParamSlider label="FM amount" bind:value={p.fmAmount} min={0} max={1} format={(v) => `${Math.round(v * 100)}%`} oncommit={commit} />
    <ParamSlider label="Unison voices" bind:value={p.unison} min={1} max={8} step={1} format={(v) => String(v)} oncommit={commit} />
    <ParamSlider label="Unison detune" bind:value={p.detune} min={0} max={50} step={1} format={(v) => `${v} ct`} oncommit={commit} />
  </section>
</div>
