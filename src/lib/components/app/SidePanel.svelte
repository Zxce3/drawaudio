<script lang="ts">
  import { ui } from '$lib/song.svelte';
  import * as Tabs from '$lib/components/ui/tabs';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import SoundTab from './SoundTab.svelte';
  import EffectsTab from './EffectsTab.svelte';
  import SequencerTab from './SequencerTab.svelte';
  import ToolsTab from './ToolsTab.svelte';
  import SongTab from './SongTab.svelte';
</script>

<aside data-guide="panel" class="bg-card flex min-h-80 w-full flex-col overflow-hidden rounded-lg border lg:w-96 lg:shrink-0" aria-label="Controls">
  <Tabs.Root bind:value={ui.panelTab} class="flex min-h-0 flex-1 flex-col">
    <Tabs.List data-guide="tabs" class="mx-2 mt-2 grid h-9 w-[calc(100%-1rem)] grid-cols-5">
      <Tabs.Trigger value="sequencer">Seq</Tabs.Trigger>
      <Tabs.Trigger value="sound">Sound</Tabs.Trigger>
      <Tabs.Trigger value="effects">FX</Tabs.Trigger>
      <Tabs.Trigger value="tools">Tools</Tabs.Trigger>
      <Tabs.Trigger value="song">Song</Tabs.Trigger>
    </Tabs.List>
    <!-- A new scroll area per tab, so every tab opens at its top -->
    {#key ui.panelTab}
    <ScrollArea class="min-h-0 flex-1">
      <div class="px-4 pt-2 pb-5">
        <Tabs.Content value="sequencer"><SequencerTab /></Tabs.Content>
        <Tabs.Content value="sound"><SoundTab /></Tabs.Content>
        <Tabs.Content value="effects"><EffectsTab /></Tabs.Content>
        <Tabs.Content value="tools"><ToolsTab /></Tabs.Content>
        <Tabs.Content value="song"><SongTab /></Tabs.Content>
      </div>
    </ScrollArea>
    {/key}
  </Tabs.Root>
</aside>
