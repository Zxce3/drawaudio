<script lang="ts">
  import type { Track } from '$lib/types';

  let { track, size }: { track: Track; size: number } = $props();
  let canvas: HTMLCanvasElement;

  $effect(() => {
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const px = 48;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = px * dpr;
    canvas.height = px * dpr;
    ctx.scale(dpr, dpr);
    const styles = getComputedStyle(canvas);
    ctx.fillStyle = styles.getPropertyValue('--background').trim();
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = styles.getPropertyValue('--grid-cell').trim();
    const cell = px / size;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) if (track.matrix[r]?.[c]) ctx.fillRect(c * cell, r * cell, Math.max(cell, 1.5), Math.max(cell, 1.5));
    }
  });
</script>

<canvas bind:this={canvas} class="size-12 shrink-0 rounded-md border" aria-hidden="true"></canvas>
