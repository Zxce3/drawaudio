<script lang="ts">
  import type { ExampleSong } from '$lib/songs';

  let { example, label }: { example: ExampleSong; label?: string } = $props();

  const song = $derived(example.create());
  const size = $derived(song.gridSize);
  const COLORS = ['#38bdf8', '#facc15', '#f472b6', '#4ade80', '#c084fc', '#fb923c', '#94a3b8', '#22d3ee'];
  const cells = $derived(
    song.tracks.flatMap((track, t) =>
      track.matrix.flatMap((row, r) => row.flatMap((on, c) => (on ? [{ r, c, color: COLORS[t % COLORS.length] }] : [])))
    )
  );
</script>

<svg viewBox="0 0 {size} {size}" class="bg-card w-full rounded-lg border" role="img" aria-label={label ?? `Piano-roll preview of ${example.name}`}>
  {#each Array(size / 4 + 1) as _, i}
    <line x1={i * 4} x2={i * 4} y1="0" y2={size} stroke="white" stroke-opacity="0.07" stroke-width="0.06" />
    <line y1={i * 4} y2={i * 4} x1="0" x2={size} stroke="white" stroke-opacity="0.07" stroke-width="0.06" />
  {/each}
  {#each cells as cell}
    <rect x={cell.c + 0.12} y={cell.r + 0.12} width="0.76" height="0.76" rx="0.12" fill={cell.color} fill-opacity="0.85" />
  {/each}
</svg>
