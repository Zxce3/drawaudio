<script lang="ts">
  import { base } from '$app/paths';
  import Seo from '$lib/components/Seo.svelte';
  import SiteShell from '$lib/components/SiteShell.svelte';
  import ExamplePreview from '$lib/components/ExamplePreview.svelte';
  import { ALL_EXAMPLES, exampleSeo } from '$lib/examples';

  let { data } = $props();

  const index = $derived(ALL_EXAMPLES.findIndex((i) => i.example.id === data.id));
  const info = $derived(ALL_EXAMPLES[index]);
  const seo = $derived(exampleSeo(info));
  const prev = $derived(ALL_EXAMPLES[(index - 1 + ALL_EXAMPLES.length) % ALL_EXAMPLES.length]);
  const next = $derived(ALL_EXAMPLES[(index + 1) % ALL_EXAMPLES.length]);
  const related = $derived(ALL_EXAMPLES.filter((i) => i.example.size === info.example.size && i.example.id !== info.example.id).slice(0, 4));
</script>

<Seo {...seo} />

<SiteShell>
  <nav aria-label="Breadcrumb" class="text-muted-foreground mb-4 text-sm">
    <a class="hover:text-foreground" href="{base}/">DrawAudio</a> ›
    <a class="hover:text-foreground" href="{base}/examples/">Example songs</a> › {info.example.name}
  </nav>

  <div class="grid gap-8 md:grid-cols-2">
    <div>
      <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">{info.example.name}</h1>
      <p class="text-muted-foreground mt-2 text-lg">{info.blurb}.</p>
      <dl class="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div class="bg-card rounded-md border p-3"><dt class="text-muted-foreground text-xs">Scale</dt><dd class="font-medium">{info.scale}</dd></div>
        <div class="bg-card rounded-md border p-3"><dt class="text-muted-foreground text-xs">Tempo</dt><dd class="font-medium">{info.tempo} BPM</dd></div>
        <div class="bg-card rounded-md border p-3"><dt class="text-muted-foreground text-xs">Grid</dt><dd class="font-medium">{info.example.size}×{info.example.size} · {info.bars} {info.bars === 1 ? 'bar' : 'bars'}</dd></div>
        <div class="bg-card rounded-md border p-3"><dt class="text-muted-foreground text-xs">Tracks</dt><dd class="font-medium">{info.trackNames.length}</dd></div>
      </dl>
      <p class="mt-6 leading-relaxed">{info.summary}</p>
      <p class="text-muted-foreground mt-3 leading-relaxed">
        Open it in DrawAudio to hear it. Then change anything: draw or erase notes, pick another scale, switch the sound of each track, and add effects like
        reverb, delay or tape. You can save it, share it as a link, or export it as MIDI or WAV.
      </p>
      <a href="{base}/?song={info.example.id}" class="bg-primary text-primary-foreground mt-6 inline-flex items-center rounded-md px-5 py-2.5 font-medium">
        Open “{info.example.name}” in DrawAudio
      </a>
    </div>
    <div>
      <ExamplePreview example={info.example} label="Piano-roll preview of {info.example.name}, one colour per track" />
      <p class="text-muted-foreground mt-2 text-xs">Preview of the notes, one colour per track: {info.trackNames.join(', ')}.</p>
    </div>
  </div>

  <section class="mt-12" aria-labelledby="more">
    <h2 id="more" class="text-xl font-semibold">More {info.example.size}×{info.example.size} example songs</h2>
    <ul class="mt-3 grid gap-2 sm:grid-cols-2">
      {#each related as other}
        <li><a class="hover:text-foreground text-muted-foreground block rounded-md border p-3" href="{base}{other.path}"><span class="text-foreground font-medium">{other.example.name}</span> · {other.scale}, {other.tempo} BPM</a></li>
      {/each}
    </ul>
    <p class="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
      <a class="text-primary underline underline-offset-2" href="{base}{prev.path}">← {prev.example.name}</a>
      <a class="text-primary underline underline-offset-2" href="{base}/examples/">All example songs</a>
      <a class="text-primary underline underline-offset-2" href="{base}{next.path}">{next.example.name} →</a>
    </p>
  </section>
</SiteShell>
