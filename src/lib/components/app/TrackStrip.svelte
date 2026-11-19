<script lang="ts">
  import { setContext } from 'svelte';
  import HelpTip from './HelpTip.svelte';
  import { Plus, Trash2, Volume2 } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Toggle } from '$lib/components/ui/toggle';
  import { Input } from '$lib/components/ui/input';
  import ParamSlider from './ParamSlider.svelte';
  import TrackThumb from './TrackThumb.svelte';
  import { song, addTrack, removeTrack, commit, MAX_TRACKS } from '$lib/song.svelte';

  setContext('help-section', 'Track');
  const db = (v: number) => (v <= 0.001 ? '-∞ dB' : `${(20 * Math.log10(v)).toFixed(1)} dB`);
</script>

<section class="flex gap-3 overflow-x-auto border-t p-3" aria-label="Tracks" data-guide="tracks">
  <div class="self-start pt-1"><HelpTip id="tracks" label="Tracks" /></div>
  {#each song.tracks as track, i (track.id)}
    <div class="bg-card flex w-72 shrink-0 gap-3 rounded-lg border p-3 {i === song.activeTrack ? 'border-primary ring-primary/30 ring-2' : ''}">
      <button class="self-start rounded-md" onclick={() => (song.activeTrack = i)} aria-label="Select {track.name}" aria-pressed={i === song.activeTrack}>
        <TrackThumb {track} rows={song.gridSize} steps={song.steps} />
      </button>
      <div class="min-w-0 flex-1 space-y-2">
        <div class="flex items-center gap-1">
          <Input bind:value={track.name} onchange={commit} class="h-7 min-w-0 flex-1 px-2 text-sm" aria-label="Track name" maxlength={40} />
          <Toggle size="sm" bind:pressed={track.mute} onPressedChange={commit} aria-label="Mute {track.name}" class="size-7 min-w-7 px-0 text-xs">M</Toggle>
          <Toggle size="sm" bind:pressed={track.solo} onPressedChange={commit} aria-label="Solo {track.name}" class="size-7 min-w-7 px-0 text-xs">S</Toggle>
          <Button variant="ghost" size="icon" class="size-7" disabled={song.tracks.length <= 1} onclick={() => removeTrack(i)} aria-label="Delete {track.name}">
            <Trash2 class="size-3.5" />
          </Button>
        </div>
        <ParamSlider label="Volume" bind:value={track.volume} min={0} max={1} format={db} oncommit={commit} />
        <div class="grid grid-cols-2 gap-3">
          <ParamSlider label="Pan" bind:value={track.pan} min={-1} max={1} format={(v) => (v === 0 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`)} oncommit={commit} />
          <ParamSlider label="Reverb" bind:value={track.reverbSend} min={0} max={1} format={(v) => `${Math.round(v * 100)}%`} oncommit={commit} />
        </div>
      </div>
    </div>
  {/each}
  {#if song.tracks.length < MAX_TRACKS}
    <Button variant="outline" class="h-auto min-h-28 w-28 shrink-0 flex-col border-dashed" onclick={addTrack}>
      <Plus class="size-5" /> Add track
    </Button>
  {:else}
    <p class="text-muted-foreground flex items-center gap-2 px-3 text-sm"><Volume2 class="size-4" /> Track limit ({MAX_TRACKS}) reached</p>
  {/if}
</section>
