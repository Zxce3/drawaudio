<script lang="ts">
  import OptionGrid from './OptionGrid.svelte';
  import ParamSlider from './ParamSlider.svelte';
  import Section from './Section.svelte';
  import WaveIcon from './WaveIcon.svelte';
  import { song, activeTrack, commit } from '$lib/song.svelte';
  import type { ArpMode, ChordType, PlaybackPattern, Waveform } from '$lib/types';

  const p = $derived(activeTrack().params);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const waves = ['sine', 'sawtooth', 'triangle', 'square', 'pulse', 'wavetable'].map((w) => ({ value: w, label: w }));
  const directions = [
    { value: 'forward', label: 'Forward →' },
    { value: 'backward', label: 'Backward ←' },
    { value: 'bounce', label: 'Bounce ↔' },
    { value: 'columns', label: 'Columns ▥' },
    { value: 'random', label: 'Random ⟳' }
  ];
  const lengths = ['1', '2', '3', '4', '5'].map((v, i) => ({ value: v, label: ['1/16', '1/8', '1/4', '1/2', '1 bar'][i] }));
  const arps = ['off', 'up', 'down', 'updown', 'random', 'pedal', 'converge', 'diverge'].map((v) => ({
    value: v,
    label: v === 'updown' ? 'up-down' : v
  }));
  const chords = ['triad', '7th', '9th', 'add9', 'sus2', 'sus4', 'power', 'octave'].map((v) => ({
    value: v,
    label: v === 'triad' ? 'Triad' : v[0].toUpperCase() + v.slice(1)
  }));
  const inversions = ['0', '1', '2', '3'].map((v, i) => ({ value: v, label: ['Root', '1st', '2nd', '3rd'][i] }));
</script>

<div>
  <Section title="Waveform">
    <OptionGrid label="Waveform" cols={6} options={waves} value={p.waveform}
      onchange={(v) => { p.waveform = v as Waveform; commit(); }}>
      {#snippet item(option)}<WaveIcon wave={option.value} /><span class="text-[10px] uppercase">{option.value === 'wavetable' ? 'WT' : option.value.slice(0, 3)}</span>{/snippet}
    </OptionGrid>
    {#if p.waveform === 'pulse'}
      <ParamSlider label="Pulse width" bind:value={p.pulseWidth} min={0.05} max={0.95} format={pct} oncommit={commit} />
    {/if}
  </Section>

  <Section title="Playback">
    <OptionGrid label="Playback direction" cols={2} options={directions} value={song.pattern}
      onchange={(v) => { song.pattern = v as PlaybackPattern; commit(); }} />
  </Section>

  <Section title="Note length">
    <OptionGrid label="Note length" cols={5} options={lengths} value={String(p.noteLength)}
      onchange={(v) => { p.noteLength = Number(v); commit(); }} />
  </Section>

  <Section title="Groove">
    <ParamSlider label="Swing" bind:value={song.swing} min={0.5} max={0.75} format={(v) => (v <= 0.5 ? 'Off' : pct(v))} oncommit={commit} />
    <ParamSlider label="Gate" bind:value={p.gate} min={0.1} max={1} format={pct} oncommit={commit} />
    <ParamSlider label="Ratchet" bind:value={p.ratchet} min={1} max={4} step={1} format={(v) => (v === 1 ? 'Off' : `×${v}`)} oncommit={commit} />
    <ParamSlider label="Glide" bind:value={p.glide} min={0} max={1} format={pct} oncommit={commit} />
  </Section>

  <Section title="Humanize">
    <ParamSlider label="Timing" bind:value={song.humanizeTiming} min={0} max={1} format={pct} oncommit={commit} />
    <ParamSlider label="Velocity" bind:value={song.humanizeVelocity} min={0} max={1} format={pct} oncommit={commit} />
  </Section>

  <Section title="Arpeggio" enabled={p.arpMode !== 'off'}
    onchange={() => { p.arpMode = p.arpMode === 'off' ? 'up' : 'off'; commit(); }}>
    <OptionGrid label="Arpeggio mode" cols={4} options={arps} value={p.arpMode}
      onchange={(v) => { p.arpMode = v as ArpMode; commit(); }} />
    <ParamSlider label="Notes per column" bind:value={p.arpNotes} min={1} max={8} step={1} format={(v) => String(v)} oncommit={commit} />
    <ParamSlider label="Octaves" bind:value={p.arpOctaves} min={1} max={4} step={1} format={(v) => String(v)} oncommit={commit} />
    <div class="flex gap-2">
      <OptionGrid label="Arp timing" cols={2} value={p.arpFit ? 'fit' : 'gate'}
        options={[{ value: 'fit', label: 'Fit length' }, { value: 'gate', label: 'Use gate' }]}
        onchange={(v) => { p.arpFit = v === 'fit'; commit(); }} />
      <OptionGrid label="Arp restart" cols={2} value={p.arpRetrigger ? 'on' : 'off'}
        options={[{ value: 'on', label: 'Retrigger' }, { value: 'off', label: 'Continue' }]}
        onchange={(v) => { p.arpRetrigger = v === 'on'; commit(); }} />
    </div>
  </Section>

  <Section title="Chords" bind:enabled={p.chordEnabled} onchange={commit}>
    <OptionGrid label="Chord type" cols={4} options={chords} value={p.chordType}
      onchange={(v) => { p.chordType = v as ChordType; commit(); }} />
    <OptionGrid label="Inversion" cols={4} options={inversions} value={String(p.chordInversion)}
      onchange={(v) => { p.chordInversion = Number(v); commit(); }} />
  </Section>
</div>
