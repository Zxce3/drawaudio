<script lang="ts">
  import { Pencil, Eraser, ArrowUp, ArrowDown, Dices } from '@lucide/svelte';
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import Choice from './Choice.svelte';
  import ParamSlider from './ParamSlider.svelte';
  import { song, ui, transpose, generatePattern, commit } from '$lib/song.svelte';
  import type { PlaybackPattern } from '$lib/types';

  let density = $state(0.4);
  const patterns = [
    { value: 'forward', label: 'Forward →' },
    { value: 'backward', label: 'Backward ←' },
    { value: 'bounce', label: 'Bounce ↔' },
    { value: 'random', label: 'Random ⟳' }
  ];
</script>

<div class="space-y-6">
  <section class="space-y-2">
    <h3 class="text-sm font-medium">Tool</h3>
    <ToggleGroup.Root type="single" value={ui.tool} onValueChange={(v) => v && (ui.tool = v as 'draw' | 'erase')} variant="outline" class="w-full">
      <ToggleGroup.Item value="draw" class="flex-1 gap-2"><Pencil class="size-4" /> Draw</ToggleGroup.Item>
      <ToggleGroup.Item value="erase" class="flex-1 gap-2"><Eraser class="size-4" /> Erase</ToggleGroup.Item>
    </ToggleGroup.Root>
    <p class="text-muted-foreground text-xs">Drag across the grid to paint. Right-click erases. Click a lit cell to remove it.</p>
  </section>

  <section class="space-y-2">
    <Label class="text-sm font-medium">Playback direction</Label>
    <Choice label="Playback direction" class="w-full" value={song.pattern} options={patterns} onchange={(v) => { song.pattern = v as PlaybackPattern; commit(); }} />
  </section>

  <section class="space-y-3">
    <h3 class="text-sm font-medium">Pattern generator</h3>
    <ParamSlider label="Density" bind:value={density} min={0.05} max={1} format={(v) => `${Math.round(v * 100)}%`} />
    <Button variant="secondary" class="w-full gap-2" onclick={() => generatePattern(density)}><Dices class="size-4" /> Generate melody</Button>
  </section>

  <section class="space-y-2">
    <h3 class="text-sm font-medium">Transpose</h3>
    <div class="grid grid-cols-2 gap-2">
      <Button variant="outline" class="gap-2" onclick={() => transpose(1)}><ArrowUp class="size-4" /> Up</Button>
      <Button variant="outline" class="gap-2" onclick={() => transpose(-1)}><ArrowDown class="size-4" /> Down</Button>
    </div>
  </section>

  <section class="space-y-2">
    <h3 class="text-sm font-medium">Shortcuts</h3>
    <dl class="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
      <dt class="text-foreground font-mono">Space</dt><dd>Play / stop</dd>
      <dt class="text-foreground font-mono">Ctrl+Z</dt><dd>Undo</dd>
      <dt class="text-foreground font-mono">Ctrl+Shift+Z</dt><dd>Redo</dd>
      <dt class="text-foreground font-mono">Arrows</dt><dd>Move cursor in grid</dd>
      <dt class="text-foreground font-mono">Enter</dt><dd>Toggle note at cursor</dd>
    </dl>
  </section>
</div>
