<script lang="ts">
  import { Slider } from '$lib/components/ui/slider';
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

  const id = `slider-${Math.random().toString(36).slice(2, 8)}`;
</script>

<div class="space-y-1.5">
  <div class="flex items-baseline justify-between">
    <Label for={id} class="text-muted-foreground text-xs">{label}</Label>
    <span class="text-muted-foreground font-mono text-xs tabular-nums">{format(value)}</span>
  </div>
  <Slider {id} type="single" bind:value {min} {max} {step} onValueCommit={() => oncommit?.()} aria-label={label} />
</div>
