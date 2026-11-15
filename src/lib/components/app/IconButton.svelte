<script lang="ts">
  import type { Component } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Tooltip from '$lib/components/ui/tooltip';

  let {
    icon: Icon,
    label,
    onclick,
    disabled = false,
    pressed,
    guide,
    variant = 'ghost',
    size = 'icon'
  }: {
    icon: Component<{ class?: string }>;
    label: string;
    onclick: () => void;
    disabled?: boolean;
    pressed?: boolean;
    guide?: string;
    variant?: 'ghost' | 'outline' | 'default' | 'secondary';
    size?: 'icon' | 'icon-sm' | 'sm';
  } = $props();
</script>

<Tooltip.Root>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <Button {...props} data-guide={guide} {variant} {size} {onclick} {disabled} aria-label={label} aria-pressed={pressed} class={pressed ? 'text-destructive' : ''}>
        <Icon class="size-4" />
      </Button>
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Content>{label}</Tooltip.Content>
</Tooltip.Root>
