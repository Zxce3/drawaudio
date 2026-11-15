<script lang="ts">
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import { pwa, applyUpdate } from '$lib/pwa.svelte';
  import { notify } from '$lib/song.svelte';

  const KEY = 'drawaudio:offline-notified';
  let dismissedUpdate = $state(false);

  // Tell people once that the app now works without a connection
  $effect(() => {
    if (!pwa.offlineReady) return;
    try {
      if (localStorage.getItem(KEY)) return;
      localStorage.setItem(KEY, '1');
    } catch {
      /* show it anyway */
    }
    notify('Ready to work offline');
  });

  let wasOnline = true;
  onMount(() => {
    wasOnline = pwa.online;
  });
  $effect(() => {
    const online = pwa.online;
    if (online === wasOnline) return;
    wasOnline = online;
    notify(online ? 'Back online' : pwa.offlineReady ? 'You are offline. DrawAudio keeps working.' : 'You are offline');
  });
</script>

{#if pwa.updateReady && !dismissedUpdate}
  <div class="bg-popover text-popover-foreground fixed right-4 bottom-4 z-40 max-w-xs rounded-lg border p-4 shadow-lg" role="alert">
    <p class="text-sm font-medium">A new version is ready</p>
    <p class="text-muted-foreground mt-1 text-xs">Reload to update. Your song is autosaved.</p>
    <div class="mt-3 flex gap-2">
      <Button size="sm" onclick={applyUpdate}>Reload</Button>
      <Button size="sm" variant="ghost" onclick={() => (dismissedUpdate = true)}>Later</Button>
    </div>
  </div>
{/if}
