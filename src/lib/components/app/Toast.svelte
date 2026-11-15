<script lang="ts">
  import { ui } from '$lib/song.svelte';
</script>

<div class="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4" role="status" aria-live="polite">
  {#if ui.toast}
    <p class="bg-popover text-popover-foreground rounded-full border px-4 py-2 text-sm shadow-lg">{ui.toast}</p>
  {/if}
</div>
