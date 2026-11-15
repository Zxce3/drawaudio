<script lang="ts">
  import { onMount } from 'svelte';
  import { song, ui, activeTrack, setCell, commit, previewCell, ensureAudio } from '$lib/song.svelte';
  import { getRowPitch, formatNote } from '$lib/scales';

  const GUTTER = 52;

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let width = $state(600);
  let height = $state(400);
  let hover = $state<{ row: number; col: number } | null>(null);
  let cursor = $state({ row: 0, col: 0 });
  let focused = $state(false);

  let dragging = false;
  let dragValue = true;
  let dragChanged = false;
  let last: { row: number; col: number } | null = null;

  const size = $derived(song.gridSize);
  const cellW = $derived((width - GUTTER) / size);
  const cellH = $derived(height / size);

  onMount(() => {
    const observer = new ResizeObserver(([entry]) => {
      width = Math.max(200, Math.floor(entry.contentRect.width));
      height = Math.max(160, Math.floor(entry.contentRect.height));
    });
    observer.observe(container);
    return () => observer.disconnect();
  });

  function cellAt(event: PointerEvent): { row: number; col: number } | null {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - GUTTER;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0) return null;
    const col = Math.floor(x / cellW);
    const row = Math.floor(y / cellH);
    return row < size && col < size ? { row, col } : null;
  }

  function paint(row: number, col: number) {
    if (setCell(row, col, dragValue)) {
      dragChanged = true;
      if (dragValue) previewCell(row);
    }
  }

  function paintLine(from: { row: number; col: number }, to: { row: number; col: number }) {
    const steps = Math.max(Math.abs(to.row - from.row), Math.abs(to.col - from.col), 1);
    for (let i = 1; i <= steps; i++) {
      paint(Math.round(from.row + ((to.row - from.row) * i) / steps), Math.round(from.col + ((to.col - from.col) * i) / steps));
    }
  }

  function onpointerdown(event: PointerEvent) {
    const cell = cellAt(event);
    if (!cell) return;
    canvas.focus();
    canvas.setPointerCapture(event.pointerId);
    // Browsers only allow audio after a gesture: start the engine on first touch
    ensureAudio();
    const erase = ui.tool === 'erase' || event.button === 2;
    dragValue = erase ? false : !activeTrack().matrix[cell.row][cell.col];
    dragging = true;
    dragChanged = false;
    last = cell;
    cursor = cell;
    paint(cell.row, cell.col);
  }

  function onpointermove(event: PointerEvent) {
    const cell = cellAt(event);
    hover = cell;
    if (!dragging || !cell || !last) return;
    if (cell.row !== last.row || cell.col !== last.col) {
      paintLine(last, cell);
      last = cell;
    }
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    last = null;
    if (dragChanged) commit();
  }

  function onkeydown(event: KeyboardEvent) {
    const move: Record<string, [number, number]> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]
    };
    if (event.key in move) {
      const [dr, dc] = move[event.key];
      cursor = {
        row: Math.min(size - 1, Math.max(0, cursor.row + dr)),
        col: Math.min(size - 1, Math.max(0, cursor.col + dc))
      };
      event.preventDefault();
    } else if (event.key === 'Enter' || event.key.toLowerCase() === 'x') {
      dragValue = !activeTrack().matrix[cursor.row][cursor.col];
      dragChanged = false;
      paint(cursor.row, cursor.col);
      if (dragChanged) commit();
      event.preventDefault();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      dragValue = false;
      paint(cursor.row, cursor.col);
      commit();
      event.preventDefault();
    }
  }

  function css(styles: CSSStyleDeclaration, name: string): string {
    return styles.getPropertyValue(name).trim();
  }

  function draw() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const styles = getComputedStyle(canvas);
    const cell = css(styles, '--grid-cell');
    const line = css(styles, '--grid-line');
    const beat = css(styles, '--grid-beat');
    const playhead = css(styles, '--playhead');
    const muted = css(styles, '--muted-foreground');
    const card = css(styles, '--card');

    ctx.fillStyle = css(styles, '--background');
    ctx.fillRect(0, 0, width, height);

    // Row bands: root notes get a light band, like piano-roll octave rows
    let previousNote = '';
    for (let row = 0; row < size; row++) {
      const pitch = getRowPitch(song.scale, size, row);
      const y = row * cellH;
      if (pitch.isRoot) {
        ctx.fillStyle = line;
        ctx.fillRect(GUTTER, y, width - GUTTER, cellH);
      }
      ctx.fillStyle = pitch.isRoot ? css(styles, '--accent') : card;
      ctx.fillRect(0, y, GUTTER - 1, cellH);
      // Dense grids repeat pitches on neighbouring rows: label each pitch once
      const note = formatNote(pitch);
      const label = (size <= 16 || pitch.isRoot) && note !== previousNote ? note : '';
      previousNote = note;
      if (label && cellH >= 7) {
        ctx.fillStyle = pitch.isRoot ? css(styles, '--foreground') : muted;
        ctx.font = `${Math.min(11, Math.max(8, cellH - 3))}px ui-monospace, monospace`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'right';
        ctx.fillText(label, GUTTER - 8, y + cellH / 2);
      }
    }

    // Column lines: every step, stronger on beats, strongest on bars
    const bar = 4 * song.beatsPerBar;
    for (let col = 0; col <= size; col++) {
      const x = GUTTER + col * cellW;
      ctx.strokeStyle = col % bar === 0 ? beat : col % 4 === 0 ? line : line;
      ctx.globalAlpha = col % bar === 0 ? 1 : col % 4 === 0 ? 1 : 0.5;
      ctx.lineWidth = col % bar === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let row = 0; row <= size; row++) {
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(GUTTER, row * cellH);
      ctx.lineTo(width, row * cellH);
      ctx.stroke();
    }

    // Playhead column
    if (ui.playing && ui.step >= 0) {
      ctx.fillStyle = playhead;
      ctx.globalAlpha = 0.12;
      ctx.fillRect(GUTTER + ui.step * cellW, 0, cellW, height);
      ctx.globalAlpha = 1;
    }

    // Notes: other tracks as faint ghosts, the active track outlined
    const drawNotes = (matrix: boolean[][], ghost: boolean) => {
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          if (!matrix[row]?.[col]) continue;
          const x = GUTTER + col * cellW + 1;
          const y = row * cellH + 1;
          const w = cellW - 2;
          const h = cellH - 2;
          const hit = ui.playing && ui.step === col;
          ctx.strokeStyle = ghost ? muted : hit ? playhead : cell;
          ctx.fillStyle = hit && !ghost ? playhead : cell;
          ctx.globalAlpha = ghost ? 0.35 : 1;
          ctx.lineWidth = ghost ? 1 : 1.5;
          if (!ghost) {
            ctx.save();
            ctx.globalAlpha = hit ? 0.55 : 0.18;
            ctx.fillRect(x, y, w, h);
            ctx.restore();
          }
          ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        }
      }
      ctx.globalAlpha = 1;
    };
    const activeIndex = Math.min(song.activeTrack, song.tracks.length - 1);
    song.tracks.forEach((track, i) => {
      if (i !== activeIndex) drawNotes(track.matrix, true);
    });
    drawNotes(song.tracks[activeIndex].matrix, false);

    // Hover and keyboard cursor
    if (hover && !dragging) {
      ctx.fillStyle = cell;
      ctx.globalAlpha = 0.12;
      ctx.fillRect(GUTTER + hover.col * cellW, hover.row * cellH, cellW, cellH);
      ctx.globalAlpha = 1;
    }
    if (focused) {
      ctx.strokeStyle = css(styles, '--ring');
      ctx.lineWidth = 2;
      ctx.strokeRect(GUTTER + cursor.col * cellW + 1, cursor.row * cellH + 1, cellW - 2, cellH - 2);
    }
  }

  $effect(() => {
    draw();
  });
</script>

<div bind:this={container} class="bg-card relative min-h-64 min-w-0 flex-1 overflow-hidden rounded-lg border">
  <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
  <canvas
    bind:this={canvas}
    style="width: {width}px; height: {height}px;"
    class="block touch-none outline-none select-none {ui.tool === 'erase' ? 'cursor-cell' : 'cursor-crosshair'}"
    role="application"
    tabindex="0"
    aria-label="Note grid for {activeTrack().name}. Arrow keys move, Enter toggles a note, Delete erases."
    {onpointerdown}
    {onpointermove}
    onpointerup={endDrag}
    onpointercancel={endDrag}
    onpointerleave={() => (hover = null)}
    oncontextmenu={(e) => e.preventDefault()}
    {onkeydown}
    onfocus={() => (focused = true)}
    onblur={() => (focused = false)}
  ></canvas>
</div>
