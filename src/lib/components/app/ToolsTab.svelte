<script lang="ts">
  import { Pencil, Eraser, ArrowUp, ArrowDown, Dices, MoveHorizontal } from '@lucide/svelte';
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import { Button } from '$lib/components/ui/button';
  import ParamSlider from './ParamSlider.svelte';
  import Section from './Section.svelte';
  import OptionGrid from './OptionGrid.svelte';
  import { ui, transpose, generatePattern, clearTrack, setSkin, VIZ_STYLES, type VizStyle } from '$lib/song.svelte';
  import { SKINS } from '$lib/skins';

  import { SHORTCUTS, GRID_SHORTCUTS } from '$lib/shortcuts';
  const groups = ['Playback', 'Editing', 'Tracks', 'Song', 'View'] as const;
  let density = $state(0.4);
  const skinOptions = SKINS.map((s) => ({ value: s.id, label: s.label }));
  const vizOptions = VIZ_STYLES.map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));
</script>

<div>
  <Section title="Tool">
    <ToggleGroup.Root type="single" value={ui.tool} onValueChange={(v) => v && (ui.tool = v as 'draw' | 'erase' | 'hold')} variant="outline" class="w-full">
      <ToggleGroup.Item value="draw" class="flex-1 gap-2"><Pencil class="size-4" /> Draw</ToggleGroup.Item>
      <ToggleGroup.Item value="hold" class="flex-1 gap-2"><MoveHorizontal class="size-4" /> Long</ToggleGroup.Item>
      <ToggleGroup.Item value="erase" class="flex-1 gap-2"><Eraser class="size-4" /> Erase</ToggleGroup.Item>
    </ToggleGroup.Root>
    <p class="text-muted-foreground text-xs">Draw: drag to paint single notes. Long: drag sideways to make one note that lasts several steps (Shift+drag does the same while drawing). Shift+Right / Shift+Left in the grid lengthen or shorten a note. Right-click erases.</p>
    <Button variant="outline" class="w-full gap-2" onclick={clearTrack}><Eraser class="size-4" /> Clear active track</Button>
  </Section>

  <Section title="Skin">
    <OptionGrid label="Skin" cols={3} options={skinOptions} value={ui.skin} onchange={(v) => setSkin(v)} />
    <p class="text-muted-foreground text-xs">Change the colours of the whole app. Press K to cycle through the skins. Your choice is remembered.</p>
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

  <Section title="Shortcuts" open={false}>
    {#each groups as group}
      <h4 class="text-muted-foreground pt-1 text-xs font-medium tracking-wide uppercase">{group}</h4>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        {#each SHORTCUTS.filter((sc) => sc.group === group) as sc}
          <dt class="text-foreground font-mono">{sc.keys}</dt><dd class="text-muted-foreground">{sc.description}</dd>
        {/each}
        {#if group === 'Editing'}
          {#each GRID_SHORTCUTS as [keys, text]}
            <dt class="text-foreground font-mono">{keys}</dt><dd class="text-muted-foreground">{text} (grid focused)</dd>
          {/each}
        {/if}
      </dl>
    {/each}
  </Section>
</div>
