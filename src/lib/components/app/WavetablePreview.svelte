<script lang="ts">
  import { wavetableShape } from '$lib/wavetables';
  import type { WavetableName } from '$lib/types';

  let { table, position }: { table: WavetableName; position: number } = $props();
  const W = 240;
  const H = 56;
  const path = $derived(
    wavetableShape(table, position)
      .map((v, i, arr) => `${i ? 'L' : 'M'}${((i / (arr.length - 1)) * (W - 8) + 4).toFixed(1)} ${(H / 2 - v * (H / 2 - 5)).toFixed(1)}`)
      .join(' ')
  );
</script>

<svg viewBox="0 0 {W} {H}" class="bg-background w-full rounded-md border" role="img" aria-label="Wavetable shape">
  <line x1="4" x2={W - 4} y1={H / 2} y2={H / 2} stroke="var(--border)" />
  <path d={path} fill="none" stroke="var(--primary)" stroke-width="1.5" stroke-linejoin="round" />
</svg>
