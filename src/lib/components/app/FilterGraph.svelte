<script lang="ts">
  import { filterResponse, type FilterSettings } from '$lib/filter';

  let { settings }: { settings: FilterSettings } = $props();

  const W = 240;
  const H = 90;
  const MIN_DB = -36;
  const MAX_DB = 18;
  const x = (freq: number) => (Math.log10(freq / 20) / 3) * (W - 8) + 4;
  const y = (db: number) => H - 6 - ((Math.min(Math.max(db, MIN_DB), MAX_DB) - MIN_DB) / (MAX_DB - MIN_DB)) * (H - 12);
  const curve = $derived(
    filterResponse({ ...settings }).map((pt, i) => `${i ? 'L' : 'M'}${x(pt.freq).toFixed(1)} ${y(pt.db).toFixed(1)}`).join(' ')
  );
  const grid = [100, 1000, 10000];
</script>

<svg viewBox="0 0 {W} {H}" class="bg-background w-full rounded-md border" role="img" aria-label="Filter frequency response">
  {#each grid as f}
    <line x1={x(f)} x2={x(f)} y1="4" y2={H - 4} stroke="var(--border)" stroke-width="1" />
    <text x={x(f) + 2} y={H - 8} font-size="7" fill="var(--muted-foreground)">{f >= 1000 ? f / 1000 + 'k' : f}</text>
  {/each}
  <line x1="4" x2={W - 4} y1={y(0)} y2={y(0)} stroke="var(--border)" stroke-dasharray="2 3" />
  <path d="{curve} L{x(20000)} {H - 6} L{x(20)} {H - 6} Z" fill="var(--primary)" fill-opacity="0.15" />
  <path d={curve} fill="none" stroke="var(--primary)" stroke-width="1.5" stroke-linejoin="round" />
</svg>
