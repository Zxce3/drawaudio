<script lang="ts">
  import { setContext, type Snippet } from 'svelte';
  import HelpTip from './HelpTip.svelte';
  import { ChevronDown } from '@lucide/svelte';
  import { Switch } from '$lib/components/ui/switch';

  let {
    title,
    enabled = $bindable<boolean | undefined>(undefined),
    open = true,
    onchange,
    children
  }: {
    title: string;
    enabled?: boolean;
    open?: boolean;
    onchange?: () => void;
    children: Snippet;
  } = $props();

  // Sliders inside look up their own help text by section title
  // svelte-ignore state_referenced_locally
  setContext('help-section', title);
</script>

<details {open} class="group border-b py-1 last:border-b-0">
  <summary class="flex cursor-pointer list-none items-center gap-2 py-2 select-none [&::-webkit-details-marker]:hidden">
    <ChevronDown class="text-muted-foreground size-4 transition-transform group-not-open:-rotate-90" />
    <h3 class="text-xs font-semibold tracking-wide uppercase">{title}</h3>
    <HelpTip id={title} label={title} />
    <span class="flex-1"></span>
    {#if enabled !== undefined}
      <!-- stop the click from toggling the section -->
      <span onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="presentation">
        <Switch bind:checked={enabled} onCheckedChange={() => onchange?.()} aria-label="Enable {title}" />
      </span>
    {/if}
  </summary>
  <div class="space-y-3 pt-1 pb-3 {enabled === false ? 'opacity-50' : ''}">
    {@render children()}
  </div>
</details>
