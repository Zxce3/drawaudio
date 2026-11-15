<script lang="ts">
  import { getContext } from 'svelte';
  import { Slider } from '$lib/components/ui/slider';
  import HelpTip from './HelpTip.svelte';
  import { helpFor } from '$lib/help';
  import { Label } from '$lib/components/ui/label';

  let {
    label,
    value = $bindable(0),
    min,
    max,
    step = 0.01,
    format = (v: number) => v.toFixed(2),
    oncommit
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    format?: (v: number) => string;
    oncommit?: () => void;
  } = $props();

  const section = getContext<string | undefined>('help-section');
  const help = $derived(helpFor(section, label));
  const id = `slider-${Math.random().toString(36).slice(2, 8)}`;
</script>

<div class="space-y-1.5">
  <div class="flex items-baseline justify-between">
    <span class="flex items-center gap-1">
      <Label for={id} class="text-muted-foreground text-xs">{label}</Label>
      {#if help}<HelpTip text={help} {label} />{/if}
    </span>
    <span class="text-muted-foreground font-mono text-xs tabular-nums">{format(value)}</span>
  </div>
  <Slider {id} type="single" bind:value {min} {max} {step} onValueCommit={() => oncommit?.()} aria-label={label} />
</div>
