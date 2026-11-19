<script lang="ts">
  import type { Track } from '$lib/types';
  import { ui } from '$lib/song.svelte';

  let { track, rows, steps }: { track: Track; rows: number; steps: number } = $props();
  let canvas: HTMLCanvasElement;

  $effect(() => {
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    void ui.skin;
    const px = 48;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = px * dpr;
    canvas.height = px * dpr;
    ctx.scale(dpr, dpr);
    const styles = getComputedStyle(canvas);
    ctx.fillStyle = styles.getPropertyValue('--background').trim();
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = styles.getPropertyValue('--grid-cell').trim();
    const cw = px / steps;
    const ch = px / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < steps; c++) if (track.matrix[r]?.[c]) ctx.fillRect(c * cw, r * ch, Math.max(cw, 1.5), Math.max(ch, 1.5));
    }
  });
</script>

<canvas bind:this={canvas} class="size-12 shrink-0 rounded-md border" aria-hidden="true"></canvas>
