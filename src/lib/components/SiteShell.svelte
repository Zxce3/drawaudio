<script lang="ts">
  import type { Snippet } from 'svelte';
  import { base } from '$app/paths';
  import { SITE } from '$lib/seo';

  let { children }: { children: Snippet } = $props();
</script>

<div class="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 sm:px-6">
  <header class="flex items-center justify-between gap-4 py-5">
    <a href="{base}/" class="text-lg font-semibold tracking-tight">Draw<span class="text-primary">Audio</span></a>
    <nav aria-label="Main" class="text-muted-foreground flex items-center gap-5 text-sm">
      <a href="{base}/examples/" class="hover:text-foreground">Example songs</a>
      <a href="{SITE.repo}" class="hover:text-foreground" rel="noopener">GitHub</a>
      <a href="{base}/" class="bg-primary text-primary-foreground rounded-md px-3 py-1.5 font-medium">Open the app</a>
    </nav>
  </header>
  <main class="flex-1 pb-16">{@render children()}</main>
  <footer class="text-muted-foreground border-t py-6 text-sm">
    <p>
      DrawAudio is a free, open-source music maker that runs in your browser.
      <a class="text-foreground underline underline-offset-2" href="{base}/">Draw your first song</a> ·
      <a class="text-foreground underline underline-offset-2" href="{SITE.repo}" rel="noopener">Source code</a>
    </p>
  </footer>
</div>
