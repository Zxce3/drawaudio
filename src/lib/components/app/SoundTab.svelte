<script lang="ts">
  import Choice from './Choice.svelte';
  import ParamSlider from './ParamSlider.svelte';
  import Section from './Section.svelte';
  import EnvelopeGraph from './EnvelopeGraph.svelte';
  import FilterGraph from './FilterGraph.svelte';
  import WavetablePreview from './WavetablePreview.svelte';
  import { WAVETABLES } from '$lib/wavetables';
  import { Label } from '$lib/components/ui/label';
  import { activeTrack, applyPreset, commit } from '$lib/song.svelte';
  import { SOUND_PRESETS, type WavetableName } from '$lib/types';

  const track = $derived(activeTrack());
  const p = $derived(track.params);
  const presets = Object.keys(SOUND_PRESETS).map((n) => ({ value: n, label: n }));
  const sec = (v: number) => (v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const hz = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${Math.round(v)} Hz`);
</script>

<div>
  <div class="space-y-1.5 pb-3">
    <Label class="text-muted-foreground text-xs">Preset for <strong class="text-foreground">{track.name}</strong></Label>
    <Choice label="Preset" class="w-full" value="" options={presets} onchange={applyPreset} />
  </div>

  <Section title="Amp envelope">
    <EnvelopeGraph attack={p.attack} decay={p.decay} sustain={p.sustain} release={p.release} />
    <div class="grid grid-cols-2 gap-x-4 gap-y-3">
      <ParamSlider label="Attack" bind:value={p.attack} min={0} max={1} format={sec} oncommit={commit} />
      <ParamSlider label="Decay" bind:value={p.decay} min={0} max={1} format={sec} oncommit={commit} />
      <ParamSlider label="Sustain" bind:value={p.sustain} min={0} max={1} format={pct} oncommit={commit} />
      <ParamSlider label="Release" bind:value={p.release} min={0} max={2} format={sec} oncommit={commit} />
    </div>
  </Section>

  <Section title="Pitch envelope" bind:enabled={p.pitchEnvEnabled} onchange={commit} open={false}>
    <ParamSlider label="Amount" bind:value={p.pitchEnvSemitones} min={-24} max={24} step={1} format={(v) => `${v > 0 ? '+' : ''}${v} st`} oncommit={commit} />
    <ParamSlider label="Time" bind:value={p.pitchEnvTime} min={0.005} max={1} format={sec} oncommit={commit} />
  </Section>

  <Section title="Wavetable" open={p.waveform === 'wavetable'}>
    <WavetablePreview table={p.wavetable} position={p.wavetablePos} />
    <Choice label="Wavetable" class="w-full" value={p.wavetable} options={WAVETABLES}
      onchange={(v) => { p.wavetable = v as WavetableName; commit(); }} />
    <ParamSlider label="Morph position" bind:value={p.wavetablePos} min={0} max={1} format={pct} oncommit={commit} />
    {#if p.waveform !== 'wavetable'}
      <p class="text-muted-foreground text-xs">Pick the WT waveform on the Seq tab to play this table.</p>
    {/if}
  </Section>

  <Section title="Filter response">
    <FilterGraph settings={{ lpEnabled: p.lpEnabled, cutoff: p.cutoff, resonance: p.resonance, hpEnabled: p.hpEnabled, hpCutoff: p.hpCutoff, hpResonance: p.hpResonance }} />
  </Section>

  <Section title="Lowpass filter" bind:enabled={p.lpEnabled} onchange={commit}>
    <div class="grid grid-cols-2 gap-x-4">
      <ParamSlider label="Cutoff" bind:value={p.cutoff} min={200} max={12000} step={50} format={hz} oncommit={commit} />
      <ParamSlider label="Resonance" bind:value={p.resonance} min={0} max={15} step={0.1} format={(v) => v.toFixed(1)} oncommit={commit} />
    </div>
  </Section>

  <Section title="Highpass filter" bind:enabled={p.hpEnabled} onchange={commit} open={false}>
    <div class="grid grid-cols-2 gap-x-4">
      <ParamSlider label="Cutoff" bind:value={p.hpCutoff} min={20} max={4000} step={10} format={hz} oncommit={commit} />
      <ParamSlider label="Resonance" bind:value={p.hpResonance} min={0} max={15} step={0.1} format={(v) => v.toFixed(1)} oncommit={commit} />
    </div>
  </Section>

  <Section title="Filter envelope" bind:enabled={p.filterEnvEnabled} onchange={commit} open={false}>
    <ParamSlider label="Sweep amount" bind:value={p.filterEnvAmount} min={0} max={1} format={pct} oncommit={commit} />
    <p class="text-muted-foreground text-xs">Opens the lowpass filter on each note and closes it over the decay time.</p>
  </Section>

  <Section title="Voices">
    <ParamSlider label="Unison voices" bind:value={p.unison} min={1} max={8} step={1} format={(v) => String(v)} oncommit={commit} />
    <ParamSlider label="Unison detune" bind:value={p.detune} min={0} max={50} step={1} format={(v) => `${v} ct`} oncommit={commit} />
    <ParamSlider label="Sub oscillator" bind:value={p.subLevel} min={0} max={1} format={pct} oncommit={commit} />
    <ParamSlider label="Noise" bind:value={p.noiseLevel} min={0} max={1} format={pct} oncommit={commit} />
  </Section>

  <Section title="FM" open={false}>
    <ParamSlider label="Amount" bind:value={p.fmAmount} min={0} max={1} format={pct} oncommit={commit} />
    <ParamSlider label="Ratio" bind:value={p.fmRatio} min={0.5} max={8} step={0.5} format={(v) => `${v}×`} oncommit={commit} />
  </Section>
</div>
