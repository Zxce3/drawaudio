<script lang="ts">
  import Choice from './Choice.svelte';
  import OptionGrid from './OptionGrid.svelte';
  import ParamSlider from './ParamSlider.svelte';
  import Section from './Section.svelte';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import { song, commit } from '$lib/song.svelte';
  import type { DelayDivision, DelayMode, ImpulseType } from '$lib/types';

  const fx = $derived(song.effects);
  const impulses = [
    { value: 'reverb', label: 'Plate reverb' },
    { value: 'guitar', label: 'Guitar cabinet' },
    { value: 'drum', label: 'Drum room' }
  ];
  const modes = [
    { value: 'pingpong', label: 'Ping Pong' },
    { value: 'mono', label: 'Mono' },
    { value: 'stereo', label: 'Stereo' },
    { value: 'slapback', label: 'Slapback' },
    { value: 'reverse', label: 'Reverse' },
    { value: 'pitch', label: 'Pitch Shift' }
  ];
  const divisions = [
    { value: '1/4', label: '1/4' },
    { value: '1/8', label: '1/8' },
    { value: '1/16', label: '1/16' },
    { value: '1/8d', label: 'Dotted 1/8' }
  ];
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const db = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
</script>

<div>
  <Section title="Reverb" bind:enabled={fx.reverbEnabled} onchange={commit}>
    <Choice label="Impulse response" class="w-full" value={fx.impulse} options={impulses} onchange={(v) => { fx.impulse = v as ImpulseType; commit(); }} />
    <div class="grid grid-cols-2 gap-x-4">
      <ParamSlider label="Mix" bind:value={fx.reverbMix} min={0} max={1} format={pct} oncommit={commit} />
      <ParamSlider label="Decay" bind:value={fx.reverbDecay} min={0.1} max={1} format={pct} oncommit={commit} />
    </div>
    <p class="text-muted-foreground text-xs">Each track's Reverb slider sets how much of it is sent here.</p>
  </Section>

  <Section title="Delay" bind:enabled={fx.delayEnabled} onchange={commit}>
    <OptionGrid label="Delay mode" cols={2} options={modes} value={fx.delayMode} onchange={(v) => { fx.delayMode = v as DelayMode; commit(); }} />
    <div class="flex items-center justify-between">
      <Label for="delay-sync" class="text-muted-foreground text-xs">Sync to tempo</Label>
      <Switch id="delay-sync" bind:checked={fx.delaySync} onCheckedChange={commit} />
    </div>
    {#if fx.delayMode === 'pitch'}
      <ParamSlider label="Pitch per repeat" bind:value={fx.delayPitch} min={-12} max={12} step={1} format={(v) => `${v > 0 ? '+' : ''}${v} st`} oncommit={commit} />
    {/if}
    {#if fx.delayMode === 'reverse'}
      <p class="text-muted-foreground text-xs">Plays each delay window backwards. Time sets the window length (up to 1.5 s).</p>
    {/if}
    {#if fx.delaySync}
      <OptionGrid label="Delay note value" cols={4} options={divisions} value={fx.delayDivision} onchange={(v) => { fx.delayDivision = v as DelayDivision; commit(); }} />
    {:else}
      <ParamSlider label="Time" bind:value={fx.delayTime} min={0.02} max={1} format={(v) => `${Math.round(v * 1000)} ms`} oncommit={commit} />
    {/if}
    <div class="grid grid-cols-2 gap-x-4">
      <ParamSlider label="Feedback" bind:value={fx.delayFeedback} min={0} max={0.9} format={pct} oncommit={commit} />
      <ParamSlider label="Mix" bind:value={fx.delayMix} min={0} max={1} format={pct} oncommit={commit} />
    </div>
  </Section>

  <Section title="Distortion" bind:enabled={fx.distortionEnabled} onchange={commit} open={false}>
    <ParamSlider label="Drive" bind:value={fx.distortion} min={0} max={50} step={1} format={(v) => String(v)} oncommit={commit} />
  </Section>

  <Section title="Bitcrusher" bind:enabled={fx.crusherEnabled} onchange={commit} open={false}>
    <ParamSlider label="Bit depth" bind:value={fx.crusherBits} min={1} max={16} step={1} format={(v) => `${v} bit`} oncommit={commit} />
    <ParamSlider label="Sample rate" bind:value={fx.crusherRate} min={0.02} max={1} format={(v) => `${Math.round(v * 100)}%`} oncommit={commit} />
    <ParamSlider label="Mix" bind:value={fx.crusherMix} min={0} max={1} format={pct} oncommit={commit} />
    <p class="text-muted-foreground text-xs">Lo-fi crunch: fewer bits and a lower sample rate sound grittier.</p>
  </Section>

  <Section title="Stereo spread" bind:enabled={fx.spreadEnabled} onchange={commit} open={false}>
    <ParamSlider label="Width" bind:value={fx.spread} min={0} max={1} format={pct} oncommit={commit} />
  </Section>

  <Section title="Chorus" bind:enabled={fx.chorusEnabled} onchange={commit} open={false}>
    <ParamSlider label="Depth" bind:value={fx.chorus} min={0} max={1} format={pct} oncommit={commit} />
  </Section>

  <Section title="Ring mod" bind:enabled={fx.ringEnabled} onchange={commit} open={false}>
    <ParamSlider label="Frequency" bind:value={fx.ringFreq} min={20} max={2000} step={5} format={(v) => `${v} Hz`} oncommit={commit} />
    <ParamSlider label="Mix" bind:value={fx.ringMix} min={0} max={1} format={pct} oncommit={commit} />
  </Section>

  <Section title="Sidechain" bind:enabled={fx.sidechainEnabled} onchange={commit} open={false}>
    <p class="text-muted-foreground text-xs">Ducks the whole mix on every pulse, for a pumping, kick-driven feel.</p>
    <OptionGrid label="Pulse rate" cols={4} options={divisions} value={fx.sidechainDivision} onchange={(v) => { fx.sidechainDivision = v as DelayDivision; commit(); }} />
    <div class="grid grid-cols-2 gap-x-4">
      <ParamSlider label="Amount" bind:value={fx.sidechainAmount} min={0} max={1} format={pct} oncommit={commit} />
      <ParamSlider label="Release" bind:value={fx.sidechainRelease} min={0.03} max={0.6} format={(v) => `${Math.round(v * 1000)} ms`} oncommit={commit} />
    </div>
  </Section>

  <Section title="Tape" bind:enabled={fx.tapeEnabled} onchange={commit} open={false}>
    <ParamSlider label="Wow & flutter" bind:value={fx.tapeWow} min={0} max={1} format={pct} oncommit={commit} />
    <ParamSlider label="Saturation" bind:value={fx.tapeSaturation} min={0} max={1} format={pct} oncommit={commit} />
    <ParamSlider label="Hiss" bind:value={fx.tapeHiss} min={0} max={1} format={pct} oncommit={commit} />
  </Section>

  <Section title="Vinyl" bind:enabled={fx.vinylEnabled} onchange={commit} open={false}>
    <ParamSlider label="Crackle" bind:value={fx.vinylCrackle} min={0} max={1} format={pct} oncommit={commit} />
    <ParamSlider label="Warmth (high cut)" bind:value={fx.vinylWarmth} min={0} max={1} format={pct} oncommit={commit} />
  </Section>

  <Section title="Equalizer" open={false}>
    <ParamSlider label="Low" bind:value={fx.eqLow} min={-12} max={12} step={0.5} format={db} oncommit={commit} />
    <ParamSlider label="Mid" bind:value={fx.eqMid} min={-12} max={12} step={0.5} format={db} oncommit={commit} />
    <ParamSlider label="High" bind:value={fx.eqHigh} min={-12} max={12} step={0.5} format={db} oncommit={commit} />
  </Section>
</div>
