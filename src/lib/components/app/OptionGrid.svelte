<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    options,
    value,
    onchange,
    label,
    cols = 4,
    item
  }: {
    options: { value: string; label: string }[];
    value: string;
    onchange: (value: string) => void;
    label: string;
    cols?: number;
    item?: Snippet<[{ value: string; label: string }]>;
  } = $props();
</script>

<div role="group" aria-label={label} class="grid gap-1" style="grid-template-columns: repeat({cols}, minmax(0, 1fr));">
  {#each options as option (option.value)}
    <button
      type="button"
      aria-pressed={value === option.value}
      onclick={() => onchange(option.value)}
      class="focus-visible:ring-ring flex min-h-8 flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none
        {value === option.value ? 'border-primary bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
    >
      {#if item}{@render item(option)}{:else}{option.label}{/if}
    </button>
  {/each}
</div>
