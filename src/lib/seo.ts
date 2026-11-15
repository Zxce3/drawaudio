/**
 * One source of truth for everything search engines and social networks read:
 * titles, descriptions, canonical URLs, Open Graph / Twitter tags and JSON-LD.
 */
export const SITE = {
  name: 'DrawAudio',
  url: 'https://drawaudio.zxce3.net',
  repo: 'https://github.com/Zxce3/drawaudio',
  locale: 'en_US',
  author: 'Memet Zx',
  themeColor: '#09090b',
  image: '/og-image.png',
  imageWidth: 1200,
  imageHeight: 630,
  imageAlt: 'DrawAudio: a grid of drawn notes with an audio visualizer and sound controls'
} as const;

export const HOME_TITLE = 'DrawAudio – Free Online Music Maker & Step Sequencer';
export const HOME_DESCRIPTION =
  'Draw notes on a grid and hear them as music. A free multi-track music maker and synth in your browser. 21 example songs, MIDI and WAV export. Works offline.';

export const FEATURES = [
  'Piano-roll grid from 8×8 to 64×64 with 18 musical scales',
  'Up to 8 tracks with synth, wavetable, FM, filters and envelopes',
  'Reverb, delay, bitcrusher, chorus, tape, vinyl and sidechain effects',
  '21 example songs, share links, and MIDI and WAV export',
  'Installable and works offline',
  'Free and open source'
] as const;

export interface PageSeo {
  /** Page title without the site name suffix rules: used as is */
  title: string;
  description: string;
  /** Path on the site, always with a leading and trailing slash, e.g. "/examples/" */
  path: string;
  image?: string;
  imageAlt?: string;
  type?: 'website' | 'article';
  /** Keep out of search results */
  noindex?: boolean;
  /** Extra JSON-LD objects for this page */
  jsonLd?: object[];
}

export const absolute = (pathOrUrl: string) => (/^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${SITE.url}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`);

export interface ResolvedSeo extends Required<Pick<PageSeo, 'title' | 'description' | 'type'>> {
  canonical: string;
  image: string;
  imageAlt: string;
  robots: string;
  jsonLd: object[];
}

export function resolveSeo(page: PageSeo): ResolvedSeo {
  return {
    title: page.title,
    description: page.description,
    type: page.type ?? 'website',
    canonical: absolute(page.path),
    image: absolute(page.image ?? SITE.image),
    imageAlt: page.imageAlt ?? SITE.imageAlt,
    robots: page.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1',
    jsonLd: page.jsonLd ?? []
  };
}

// ---------------------------------------------------------------- JSON-LD

export function webApplicationLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${SITE.url}/#app`,
    name: SITE.name,
    url: `${SITE.url}/`,
    description: HOME_DESCRIPTION,
    applicationCategory: 'MultimediaApplication',
    applicationSubCategory: 'Music sequencer',
    operatingSystem: 'Any. Runs in a modern web browser',
    browserRequirements: 'Requires JavaScript and the Web Audio API',
    inLanguage: 'en',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    image: absolute(SITE.image),
    screenshot: absolute('/og-image.png'),
    featureList: [...FEATURES],
    license: 'https://opensource.org/licenses/MIT',
    author: { '@type': 'Person', name: SITE.author },
    sameAs: [SITE.repo]
  };
}

export function websiteLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE.url}/#website`,
    name: SITE.name,
    url: `${SITE.url}/`,
    inLanguage: 'en',
    publisher: { '@type': 'Person', name: SITE.author }
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: absolute(item.path) }))
  };
}

/** Serialise JSON-LD so it can never close its own <script> tag */
export const jsonLdScript = (data: object) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
