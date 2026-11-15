<script lang="ts">
  let { attack, decay, sustain, release }: { attack: number; decay: number; sustain: number; release: number } = $props();

  const W = 240;
  const H = 70;
  // Each stage gets a share of the width so short envelopes stay readable
  const total = $derived(Math.max(attack + decay + release + 0.3, 0.4));
  const x = (t: number) => (t / total) * (W - 8) + 4;
  const y = (level: number) => H - 6 - level * (H - 14);
  const d = $derived(
    `M${x(0)} ${y(0)} L${x(attack)} ${y(1)} L${x(attack + decay)} ${y(sustain)} L${x(attack + decay + 0.3)} ${y(sustain)} L${x(attack + decay + 0.3 + release)} ${y(0)}`
  );
</script>

<svg viewBox="0 0 {W} {H}" class="bg-background w-full rounded-md border" role="img" aria-label="Amp envelope shape">
  <path d="{d} L{x(attack + decay + 0.3 + release)} {y(0)} L{x(0)} {y(0)} Z" fill="var(--primary)" fill-opacity="0.15" />
  <path {d} fill="none" stroke="var(--primary)" stroke-width="1.5" stroke-linejoin="round" />
  {#each [[0, 0], [attack, 1], [attack + decay, sustain], [attack + decay + 0.3 + release, 0]] as [t, level]}
    <circle cx={x(t)} cy={y(level)} r="3" fill="var(--primary)" />
  {/each}
</svg>
