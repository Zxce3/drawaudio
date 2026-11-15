<script lang="ts">
  import { Pencil, Eraser, ArrowUp, ArrowDown, Dices } from '@lucide/svelte';
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import { Button } from '$lib/components/ui/button';
  import ParamSlider from './ParamSlider.svelte';
  import Section from './Section.svelte';
  import OptionGrid from './OptionGrid.svelte';
  import { ui, transpose, generatePattern, clearTrack, VIZ_STYLES, type VizStyle } from '$lib/song.svelte';

  let density = $state(0.4);
  const vizOptions = VIZ_STYLES.map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));
</script>

<div>
  <Section title="Tool">
    <ToggleGroup.Root type="single" value={ui.tool} onValueChange={(v) => v && (ui.tool = v as 'draw' | 'erase')} variant="outline" class="w-full">
      <ToggleGroup.Item value="draw" class="flex-1 gap-2"><Pencil class="size-4" /> Draw</ToggleGroup.Item>
      <ToggleGroup.Item value="erase" class="flex-1 gap-2"><Eraser class="size-4" /> Erase</ToggleGroup.Item>
    </ToggleGroup.Root>
    <p class="text-muted-foreground text-xs">Drag across the grid to paint. Right-click erases. Click a lit cell to remove it.</p>
    <Button variant="outline" class="w-full gap-2" onclick={clearTrack}><Eraser class="size-4" /> Clear active track</Button>
  </Section>

  <Section title="Visualizer">
    <OptionGrid label="Visualizer style" cols={5} options={vizOptions} value={ui.vizStyle} onchange={(v) => (ui.vizStyle = v as VizStyle)} />
    <ParamSlider label="Opacity" bind:value={ui.vizOpacity} min={0.03} max={0.6} step={0.01} format={(v) => `${Math.round(v * 100)}%`} />
    <p class="text-muted-foreground text-xs">The music is drawn behind the grid while it plays. Turn it off to save battery.</p>
  </Section>

  <Section title="Pattern generator">
    <ParamSlider label="Density" bind:value={density} min={0.05} max={1} format={(v) => `${Math.round(v * 100)}%`} />
    <Button variant="secondary" class="w-full gap-2" onclick={() => generatePattern(density)}><Dices class="size-4" /> Generate melody</Button>
  </Section>

  <Section title="Transpose">
    <div class="grid grid-cols-2 gap-2">
      <Button variant="outline" class="gap-2" onclick={() => transpose(1)}><ArrowUp class="size-4" /> Up</Button>
      <Button variant="outline" class="gap-2" onclick={() => transpose(-1)}><ArrowDown class="size-4" /> Down</Button>
    </div>
  </Section>

  <Section title="Shortcuts">
    <dl class="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
      <dt class="text-foreground font-mono">Space</dt><dd>Play / stop</dd>
      <dt class="text-foreground font-mono">Ctrl+Z</dt><dd>Undo</dd>
      <dt class="text-foreground font-mono">Ctrl+Shift+Z</dt><dd>Redo</dd>
      <dt class="text-foreground font-mono">Arrows</dt><dd>Move cursor in grid</dd>
      <dt class="text-foreground font-mono">Enter</dt><dd>Toggle note at cursor</dd>
    </dl>
  </Section>
</div>
