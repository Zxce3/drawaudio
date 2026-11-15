<script lang="ts">
  import Choice from './Choice.svelte';
  import ParamSlider from './ParamSlider.svelte';
  import { Label } from '$lib/components/ui/label';
  import { song, commit } from '$lib/song.svelte';
  import type { ImpulseType } from '$lib/types';

  const fx = song.effects;
  const impulses = [
    { value: 'reverb', label: 'Plate reverb' },
    { value: 'guitar', label: 'Guitar cabinet' },
    { value: 'drum', label: 'Drum room' }
  ];
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const db = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
</script>

<div class="space-y-5">
  <section class="space-y-3">
    <h3 class="text-sm font-medium">Delay</h3>
    <ParamSlider label="Time" bind:value={fx.delayTime} min={0.02} max={1} format={(v) => `${Math.round(v * 1000)} ms`} oncommit={commit} />
    <ParamSlider label="Feedback" bind:value={fx.delayFeedback} min={0} max={0.9} format={pct} oncommit={commit} />
    <ParamSlider label="Mix" bind:value={fx.delayMix} min={0} max={1} format={pct} oncommit={commit} />
  </section>

  <section class="space-y-3">
    <h3 class="text-sm font-medium">Reverb</h3>
    <div class="space-y-1.5">
      <Label class="text-muted-foreground text-xs">Space</Label>
      <Choice label="Impulse response" class="w-full" value={fx.impulse} options={impulses} onchange={(v) => { fx.impulse = v as ImpulseType; commit(); }} />
    </div>
    <ParamSlider label="Mix" bind:value={fx.reverbMix} min={0} max={1} format={pct} oncommit={commit} />
    <p class="text-muted-foreground text-xs">Each track's Reverb slider controls how much of it is sent here.</p>
  </section>

  <section class="space-y-3">
    <h3 class="text-sm font-medium">Colour</h3>
    <ParamSlider label="Distortion" bind:value={fx.distortion} min={0} max={50} step={1} format={(v) => String(v)} oncommit={commit} />
    <ParamSlider label="Chorus" bind:value={fx.chorus} min={0} max={1} format={pct} oncommit={commit} />
  </section>

  <section class="space-y-3">
    <h3 class="text-sm font-medium">Equalizer</h3>
    <ParamSlider label="Low" bind:value={fx.eqLow} min={-12} max={12} step={0.5} format={db} oncommit={commit} />
    <ParamSlider label="Mid" bind:value={fx.eqMid} min={-12} max={12} step={0.5} format={db} oncommit={commit} />
    <ParamSlider label="High" bind:value={fx.eqHigh} min={-12} max={12} step={0.5} format={db} oncommit={commit} />
  </section>
</div>
