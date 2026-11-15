<script lang="ts">
  import { SITE, resolveSeo, jsonLdScript, type PageSeo } from '$lib/seo';

  let page: PageSeo = $props();
  const seo = $derived(resolveSeo(page));
</script>

<svelte:head>
  <title>{seo.title}</title>
  <meta name="description" content={seo.description} />
  <meta name="robots" content={seo.robots} />
  <meta name="author" content={SITE.author} />
  <link rel="canonical" href={seo.canonical} />

  <!-- Open Graph -->
  <meta property="og:site_name" content={SITE.name} />
  <meta property="og:locale" content={SITE.locale} />
  <meta property="og:type" content={seo.type} />
  <meta property="og:url" content={seo.canonical} />
  <meta property="og:title" content={seo.title} />
  <meta property="og:description" content={seo.description} />
  <meta property="og:image" content={seo.image} />
  <meta property="og:image:width" content={String(SITE.imageWidth)} />
  <meta property="og:image:height" content={String(SITE.imageHeight)} />
  <meta property="og:image:alt" content={seo.imageAlt} />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={seo.title} />
  <meta name="twitter:description" content={seo.description} />
  <meta name="twitter:image" content={seo.image} />
  <meta name="twitter:image:alt" content={seo.imageAlt} />

  {#each seo.jsonLd as data}
    {@html jsonLdScript(data)}
  {/each}
</svelte:head>
