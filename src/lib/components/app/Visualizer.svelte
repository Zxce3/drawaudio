<script lang="ts">
  import { onMount } from 'svelte';
  import { ui, getEngine } from '$lib/song.svelte';

  const BANDS = 48;

  let canvas: HTMLCanvasElement;
  let container: HTMLDivElement;
  let width = $state(600);
  let height = $state(400);
  const levels = new Float32Array(BANDS);
  const raw = new Float32Array(BANDS);
  let raf = 0;

  onMount(() => {
    const observer = new ResizeObserver(([entry]) => {
      width = Math.max(100, Math.floor(entry.contentRect.width));
      height = Math.max(100, Math.floor(entry.contentRect.height));
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  });

  /** Run while playing, and until the bars have faded out afterwards */
  $effect(() => {
    const style = ui.vizStyle;
    const playing = ui.playing;
    void width;
    void height;
    cancelAnimationFrame(raf);
    if (!canvas) return;
    if (style === 'off') {
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const tick = () => {
      const alive = draw(style, playing);
      if (alive || playing) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  });

  /** Returns true while anything is still visible */
  function draw(style: string, playing: boolean): boolean {
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Fast attack, slow release so the shapes feel physical
    const engine = getEngine();
    const live = playing && engine.getBands(raw);
    let peak = 0;
    for (let i = 0; i < BANDS; i++) {
      const target = live ? raw[i] : 0;
      levels[i] = target > levels[i] ? levels[i] + (target - levels[i]) * 0.6 : levels[i] * 0.92;
      peak = Math.max(peak, levels[i]);
    }
    if (peak < 0.005) return false;

    const color = getComputedStyle(canvas).getPropertyValue('--primary').trim();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    if (style === 'bars') drawBars(ctx);
    else if (style === 'circle') drawCircle(ctx);
    else if (style === 'wave') drawWave(ctx, live ? engine.getWaveform() : null, peak);
    else drawGlow(ctx, color);
    return true;
  }

  function drawBars(ctx: CanvasRenderingContext2D) {
    const gap = 3;
    const w = (width - gap * (BANDS - 1)) / BANDS;
    // Fade each bar out toward its tip so it reads as a soft backdrop
    const fade = ctx.createLinearGradient(0, height, 0, height * 0.1);
    fade.addColorStop(0, ctx.fillStyle as string);
    fade.addColorStop(1, 'transparent');
    ctx.fillStyle = fade;
    for (let i = 0; i < BANDS; i++) {
      const h = Math.max(2, levels[i] ** 1.2 * height * 0.9);
      ctx.beginPath();
      ctx.roundRect(i * (w + gap), height - h, w, h, Math.min(w / 2, 6));
      ctx.fill();
    }
  }

  function drawCircle(ctx: CanvasRenderingContext2D) {
    const cx = width / 2;
    const cy = height / 2;
    const inner = Math.min(width, height) * 0.2;
    const reach = Math.min(width, height) * 0.3;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, (2 * Math.PI * inner) / BANDS / 2);
    for (let i = 0; i < BANDS; i++) {
      // Mirror the spectrum so the ring is symmetric
      const band = levels[i < BANDS / 2 ? i * 2 : (BANDS - 1 - i) * 2 + 1] ?? levels[i];
      const angle = (i / BANDS) * Math.PI * 2 - Math.PI / 2;
      const len = 4 + band ** 1.2 * reach;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx.lineTo(cx + Math.cos(angle) * (inner + len), cy + Math.sin(angle) * (inner + len));
      ctx.stroke();
    }
  }

  function drawWave(ctx: CanvasRenderingContext2D, wave: Float32Array | null, peak: number) {
    const mid = height / 2;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    for (const [scale, alpha] of [[1, 1], [0.55, 0.45]] as const) {
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      const points = 160;
      for (let i = 0; i < points; i++) {
        const sample = wave ? wave[Math.floor((i / points) * wave.length * 0.5)] : 0;
        const y = mid + sample * height * 0.45 * scale * Math.min(1, 0.5 + peak);
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo((i / (points - 1)) * width, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawGlow(ctx: CanvasRenderingContext2D, color: string) {
    const cx = width / 2;
    const cy = height / 2;
    const base = Math.min(width, height) * 0.18;
    const bass = (levels[0] + levels[1] + levels[2] + levels[3]) / 4;
    const radius = base + bass * base * 1.6;
    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius * 1.9);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // A ring that deforms with the spectrum
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= BANDS; i++) {
      const angle = (i / BANDS) * Math.PI * 2;
      const band = levels[(i % BANDS < BANDS / 2 ? i % BANDS : BANDS - 1 - (i % BANDS)) * 2] ?? 0;
      const r = radius + band * base * 0.9;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
</script>

<div bind:this={container} class="pointer-events-none absolute inset-0" aria-hidden="true" style="opacity: {ui.vizOpacity};">
  <canvas bind:this={canvas} style="width: {width}px; height: {height}px;" class="block"></canvas>
</div>
