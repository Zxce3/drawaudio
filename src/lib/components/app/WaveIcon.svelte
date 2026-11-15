<script lang="ts">
  let { wave }: { wave: string } = $props();
  const paths: Record<string, string> = {
    sine: 'M1 8 C5 -2 9 -2 12 8 S19 18 23 8',
    sawtooth: 'M1 14 L12 2 V14 L23 2',
    triangle: 'M1 8 L6 2 L18 14 L23 8',
    square: 'M1 14 V3 H12 V14 H23 V3',
    pulse: 'M1 14 H6 V3 H11 V14 H17 V3 H21 V14'
  };
</script>

<svg viewBox="0 0 24 16" class="h-4 w-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">
  <path d={paths[wave]} />
</svg>
