<script lang="ts">
  import { onMount } from 'svelte';
  import Visualizer from './Visualizer.svelte';
  import { song, ui, activeTrack, setCell, setHeldNote, adjustNoteLength, commit, previewCell, ensureAudio } from '$lib/song.svelte';
  import { heldSteps } from '$lib/types';
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
  // Long-note drag: the run being drawn, applied when the pointer is released
  let holdDrag: { row: number; from: number } | null = null;
  let holdPreview = $state<{ row: number; from: number; to: number } | null>(null);
  // Dragging the right edge of an existing note resizes it in place, with any tool except erase
  let resizing: { end: number; moved: boolean } | null = null;
  let hoverEdge = $state(false);

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

  /** The note whose right edge is under the pointer (the last 35% of its final cell), if any */
  function edgeAt(event: PointerEvent): { row: number; head: number; end: number } | null {
    const cell = cellAt(event);
    if (!cell) return null;
    const matrix = activeTrack().matrix;
    const ties = activeTrack().ties;
    if (!matrix[cell.row][cell.col]) return null;
    let head = cell.col;
    while (head > 0 && ties[cell.row][head]) head--;
    const end = head + heldSteps(ties, cell.row, head) - 1;
    if (cell.col !== end) return null;
    const rect = canvas.getBoundingClientRect();
    const within = (event.clientX - rect.left - GUTTER) / cellW - cell.col;
    return within >= 0.65 ? { row: cell.row, head, end } : null;
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
    const edge = erase ? null : edgeAt(event);
    if (edge) {
      resizing = { end: edge.end, moved: false };
      holdDrag = { row: edge.row, from: edge.head };
      holdPreview = { row: edge.row, from: edge.head, to: edge.end };
      dragging = true;
      dragChanged = false;
      last = cell;
      cursor = cell;
      return;
    }
    // Long-note tool (or Shift while drawing): drag sideways to set how long one note lasts
    if (!erase && (ui.tool === 'hold' || event.shiftKey)) {
      holdDrag = { row: cell.row, from: cell.col };
      holdPreview = { row: cell.row, from: cell.col, to: cell.col };
      dragging = true;
      dragChanged = false;
      last = cell;
      cursor = cell;
      previewCell(cell.row);
      return;
    }
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
    hoverEdge = !dragging && ui.tool !== 'erase' && !!edgeAt(event);
    if (!dragging || !cell || !last) return;
    if (holdDrag) {
      const to = resizing ? Math.max(cell.col, holdDrag.from) : cell.col;
      if (resizing && to !== resizing.end) resizing.moved = true;
      holdPreview = { row: holdDrag.row, from: holdDrag.from, to };
      return;
    }
    if (cell.row !== last.row || cell.col !== last.col) {
      paintLine(last, cell);
      last = cell;
    }
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    last = null;
    if (holdDrag && holdPreview) {
      const { row, from, to } = holdPreview;
      const track = activeTrack();
      if (resizing && !resizing.moved) {
        // Pressed on a note's edge without dragging: behave like a click on that cell
        dragValue = !track.matrix[row][resizing.end];
        paint(row, resizing.end);
      } else if (resizing) {
        // Shrinking: the cells the note no longer covers are removed
        for (let c = to + 1; c <= resizing.end; c++) {
          track.matrix[row][c] = false;
          track.ties[row][c] = false;
        }
        setHeldNote(row, from, to);
        dragChanged = true;
      } else if (from === to) {
        // A plain click still toggles the cell, like the draw tool
        dragValue = !track.matrix[row][from];
        paint(row, from);
      } else {
        setHeldNote(row, from, to);
        dragChanged = true;
      }
      holdDrag = null;
      holdPreview = null;
      resizing = null;
    }
    if (dragChanged) commit();
  }

  function onkeydown(event: KeyboardEvent) {
    const move: Record<string, [number, number]> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]
    };
    if (event.shiftKey && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      // Shift+Right / Shift+Left lengthen or shorten the note under the cursor
      if (adjustNoteLength(cursor.row, cursor.col, event.key === 'ArrowRight' ? 1 : -1)) commit();
      event.preventDefault();
    } else if (event.key in move) {
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
    void ui.skin; // redraw when the colours change
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

    // Transparent: the visualizer and background colour show through the grid
    ctx.clearRect(0, 0, width, height);

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
    const drawNotes = (matrix: boolean[][], ties: boolean[][], ghost: boolean) => {
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          // Tied cells are drawn as part of the note they continue
          if (!matrix[row]?.[col] || ties?.[row]?.[col]) continue;
          const length = heldSteps(ties ?? [], row, col);
          const x = GUTTER + col * cellW + 1;
          const y = row * cellH + 1;
          const w = cellW * length - 2;
          const h = cellH - 2;
          const hit = ui.playing && ui.step >= col && ui.step < col + length;
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
          if (!ghost) {
            // Grab handle on the right edge: drag it to change the note's duration
            ctx.fillStyle = hit ? playhead : cell;
            ctx.globalAlpha = 0.9;
            ctx.fillRect(x + w - 3, y + 2, 3, Math.max(2, h - 4));
          }
        }
      }
      ctx.globalAlpha = 1;
    };
    const activeIndex = Math.min(song.activeTrack, song.tracks.length - 1);
    song.tracks.forEach((track, i) => {
      if (i !== activeIndex) drawNotes(track.matrix, track.ties, true);
    });
    drawNotes(song.tracks[activeIndex].matrix, song.tracks[activeIndex].ties, false);

    // The long note being dragged out
    if (holdPreview) {
      const a = Math.min(holdPreview.from, holdPreview.to);
      const b = Math.max(holdPreview.from, holdPreview.to);
      ctx.fillStyle = cell;
      ctx.strokeStyle = cell;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(GUTTER + a * cellW + 1, holdPreview.row * cellH + 1, (b - a + 1) * cellW - 2, cellH - 2);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(GUTTER + a * cellW + 1.5, holdPreview.row * cellH + 1.5, (b - a + 1) * cellW - 3, cellH - 3);
    }

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

<div bind:this={container} data-guide="grid" class="bg-background relative min-h-64 min-w-0 flex-1 overflow-hidden rounded-lg border">
  <Visualizer />
  <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
  <canvas
    bind:this={canvas}
    style="width: {width}px; height: {height}px;"
    class="relative block touch-none outline-none select-none {ui.tool === 'erase' ? 'cursor-cell' : hoverEdge || ui.tool === 'hold' ? 'cursor-ew-resize' : 'cursor-crosshair'}"
    role="application"
    tabindex="0"
    aria-label="Note grid for {activeTrack().name}. Arrow keys move, Enter toggles a note, Shift plus Right or Left lengthens or shortens it, Delete erases."
    {onpointerdown}
    {onpointermove}
    onpointerup={endDrag}
    onpointercancel={endDrag}
    onpointerleave={() => ((hover = null), (hoverEdge = false))}
    oncontextmenu={(e) => e.preventDefault()}
    {onkeydown}
    onfocus={() => (focused = true)}
    onblur={() => (focused = false)}
  ></canvas>
</div>
