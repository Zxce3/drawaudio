<script lang="ts">
  import { CircleHelp } from '@lucide/svelte';
  import * as Popover from '$lib/components/ui/popover';
  import { HELP } from '$lib/help';

  let { id, text, label }: { id?: string; text?: string; label?: string } = $props();

  const body = $derived(text ?? (id ? HELP[id] : undefined));
  const name = $derived(label ?? id?.split('/').pop() ?? 'this control');

  // There are over a hundred of these on screen. Until someone actually asks for help, a plain button is
  // rendered; the popover machinery is only created on the first click, which keeps start-up fast.
  let activated = $state(false);
  let open = $state(false);
  const triggerClass =
    'text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-6 -m-1 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none';
</script>

{#if body}
  {#if !activated}
    <button
      type="button"
      class={triggerClass}
      aria-label="Help: {name}"
      aria-haspopup="dialog"
      aria-expanded="false"
      onclick={(e) => {
        e.stopPropagation();
        activated = true;
        open = true;
      }}
      onkeydown={(e) => e.stopPropagation()}
    >
      <CircleHelp class="size-3.5" />
    </button>
  {:else}
    <Popover.Root bind:open>
      <Popover.Trigger
        class={triggerClass}
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
{/if}
