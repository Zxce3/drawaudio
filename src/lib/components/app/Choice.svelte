<script lang="ts">
  import * as Select from '$lib/components/ui/select';

  let {
    value,
    options,
    onchange,
    label,
    class: className = ''
  }: {
    value: string;
    options: { value: string; label: string }[];
    onchange: (value: string) => void;
    label: string;
    class?: string;
  } = $props();

  const current = $derived(options.find((o) => o.value === value)?.label ?? value);
</script>

<Select.Root type="single" {value} onValueChange={onchange}>
  <Select.Trigger class={className} aria-label={label}>{current}</Select.Trigger>
  <Select.Content class="max-h-72">
    {#each options as option (option.value)}
      <Select.Item value={option.value} label={option.label}>{option.label}</Select.Item>
    {/each}
  </Select.Content>
</Select.Root>
