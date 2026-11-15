<script lang="ts">
  import { CircleHelp } from '@lucide/svelte';
  import * as Popover from '$lib/components/ui/popover';
  import { HELP } from '$lib/help';

  let { id, text, label }: { id?: string; text?: string; label?: string } = $props();

  const body = $derived(text ?? (id ? HELP[id] : undefined));
  const name = $derived(label ?? id?.split('/').pop() ?? 'this control');
</script>

{#if body}
  <Popover.Root>
    <Popover.Trigger
      class="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-4 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
      aria-label="Help: {name}"
      onclick={(e: MouseEvent) => e.stopPropagation()}
      onkeydown={(e: KeyboardEvent) => e.stopPropagation()}
    >
      <CircleHelp class="size-3.5" />
    </Popover.Trigger>
    <Popover.Content class="w-72 text-xs leading-relaxed" side="top" align="start">
      <p class="mb-1 text-sm font-medium">{name}</p>
      <p class="text-muted-foreground">{body}</p>
    </Popover.Content>
  </Popover.Root>
{/if}
