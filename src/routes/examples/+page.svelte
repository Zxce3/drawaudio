<script lang="ts">
  import { base } from '$app/paths';
  import Seo from '$lib/components/Seo.svelte';
  import SiteShell from '$lib/components/SiteShell.svelte';
  import ExamplePreview from '$lib/components/ExamplePreview.svelte';
  import { ALL_EXAMPLES, examplesSeo } from '$lib/examples';

  const seo = examplesSeo();
  const groups = [16, 32, 64].map((size) => ({ size, bars: size / 16, items: ALL_EXAMPLES.filter((i) => i.example.size === size) }));
</script>

<Seo {...seo} />

<SiteShell>
  <nav aria-label="Breadcrumb" class="text-muted-foreground mb-4 text-sm"><a class="hover:text-foreground" href="{base}/">DrawAudio</a> › Example songs</nav>
  <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Example songs</h1>
  <p class="text-muted-foreground mt-3 max-w-2xl">
    Twenty ready-made songs for the DrawAudio music maker, from lo-fi and synthwave to chiptune and ambient. Open any of them in your browser, change a few
    notes, swap the sound, and make it yours. Everything is free and works offline.
  </p>

  {#each groups as group}
    <section class="mt-10" aria-labelledby="grid-{group.size}">
      <h2 id="grid-{group.size}" class="text-xl font-semibold">{group.size}×{group.size} grid · {group.bars} {group.bars === 1 ? 'bar' : 'bars'}</h2>
      <ul class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each group.items as info}
          <li class="bg-card flex flex-col gap-3 rounded-lg border p-3">
            <a href="{base}{info.path}" class="block" aria-label="{info.example.name}: preview">
              <ExamplePreview example={info.example} />
            </a>
            <div>
              <h3 class="font-medium"><a class="hover:underline" href="{base}{info.path}">{info.example.name}</a></h3>
              <p class="text-muted-foreground mt-1 text-sm">{info.blurb}</p>
              <p class="text-muted-foreground mt-2 text-xs">{info.scale} · {info.tempo} BPM · {info.trackNames.length} tracks</p>
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</SiteShell>
