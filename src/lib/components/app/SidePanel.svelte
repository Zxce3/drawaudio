<script lang="ts">
  import * as Tabs from '$lib/components/ui/tabs';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import SoundTab from './SoundTab.svelte';
  import EffectsTab from './EffectsTab.svelte';
  import EditTab from './EditTab.svelte';
  import SongTab from './SongTab.svelte';
</script>

<aside class="bg-card flex min-h-80 w-full flex-col overflow-hidden rounded-lg border lg:w-80 lg:shrink-0" aria-label="Controls">
  <Tabs.Root value="edit" class="flex min-h-0 flex-1 flex-col">
    <Tabs.List class="mx-2 mt-2 grid h-9 w-[calc(100%-1rem)] grid-cols-4">
      <Tabs.Trigger value="edit">Edit</Tabs.Trigger>
      <Tabs.Trigger value="sound">Sound</Tabs.Trigger>
      <Tabs.Trigger value="effects">Effects</Tabs.Trigger>
      <Tabs.Trigger value="song">Song</Tabs.Trigger>
    </Tabs.List>
    <ScrollArea class="min-h-0 flex-1">
      <div class="px-4 pt-2 pb-5">
        <Tabs.Content value="edit"><EditTab /></Tabs.Content>
        <Tabs.Content value="sound"><SoundTab /></Tabs.Content>
        <Tabs.Content value="effects"><EffectsTab /></Tabs.Content>
        <Tabs.Content value="song"><SongTab /></Tabs.Content>
      </div>
    </ScrollArea>
  </Tabs.Root>
</aside>
