<script lang="ts">
  import * as publicEnv from '$env/static/public';
  import { SITE, resolveSeo, jsonLdScript, type PageSeo } from '$lib/seo';

  // Search engine ownership tokens come from the build environment (see docs/search-console.md); they are optional
  const env = publicEnv as unknown as Record<string, string | undefined>;
  const googleToken = env.PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  const bingToken = env.PUBLIC_BING_SITE_VERIFICATION?.trim();

  let page: PageSeo = $props();
  const seo = $derived(resolveSeo(page));
</script>

<svelte:head>
  <title>{seo.title}</title>
  <meta name="description" content={seo.description} />
  <meta name="robots" content={seo.robots} />
  <meta name="author" content={SITE.author} />
  <link rel="canonical" href={seo.canonical} />
  {#if page.path === '/'}
    {#if googleToken}<meta name="google-site-verification" content={googleToken} />{/if}
    {#if bingToken}<meta name="msvalidate.01" content={bingToken} />{/if}
  {/if}

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
