import { EXAMPLE_SONGS, type ExampleSong } from './songs';
import { scaleLabel } from './scales';
import { SITE, absolute, breadcrumbLd, type PageSeo } from './seo';

export interface ExampleInfo {
  example: ExampleSong;
  bars: number;
  scale: string;
  tempo: number;
  trackNames: string[];
  title: string;
  description: string;
  /** The example's one-liner without the trailing "(2 bars)" hint */
  blurb: string;
  summary: string;
  path: string;
}

export const examplePath = (id: string) => `/examples/${id}/`;

export function exampleInfo(example: ExampleSong): ExampleInfo {
  const song = example.create();
  const bars = song.steps / 16;
  const scale = scaleLabel(song.scale);
  const trackNames = song.tracks.map((t) => t.name);
  const barText = `${bars}-bar`;
  const blurb = example.description.replace(/\s*\(\d+ bars?\)\s*$/, '');
  return {
    example,
    bars,
    scale,
    tempo: song.tempo,
    trackNames,
    path: examplePath(example.id),
    title: `${example.name}: ${scale} Example Song, ${song.tempo} BPM | DrawAudio`,
    blurb,
    description: `${blurb}. A ${barText} ${scale} example song at ${song.tempo} BPM. Open it free in DrawAudio and remix it.`,
    summary: `${example.name} is a ${barText} piece in ${scale} at ${song.tempo} BPM, drawn on a ${example.size}×${example.size} grid with ${trackNames.length} tracks: ${trackNames.join(', ')}.`
  };
}

export const ALL_EXAMPLES = EXAMPLE_SONGS.map(exampleInfo);

export const EXAMPLES_TITLE = 'Example Songs: 21 Free Music Maker Templates | DrawAudio';
export const EXAMPLES_DESCRIPTION =
  '21 ready-made songs for DrawAudio on 16×16, 32×32 and 64×64 grids: lo-fi, synthwave, chiptune, ambient and more. Open any in your browser and remix it.';

export function examplesSeo(): PageSeo {
  return {
    title: EXAMPLES_TITLE,
    description: EXAMPLES_DESCRIPTION,
    path: '/examples/',
    jsonLd: [
      breadcrumbLd([{ name: 'DrawAudio', path: '/' }, { name: 'Example songs', path: '/examples/' }]),
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'DrawAudio example songs',
        url: absolute('/examples/'),
        description: EXAMPLES_DESCRIPTION,
        isPartOf: { '@id': `${SITE.url}/#website` },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: ALL_EXAMPLES.map((info, i) => ({ '@type': 'ListItem', position: i + 1, name: info.example.name, url: absolute(info.path) }))
        }
      }
    ]
  };
}

export function exampleSeo(info: ExampleInfo): PageSeo {
  return {
    title: info.title,
    description: info.description,
    path: info.path,
    jsonLd: [
      breadcrumbLd([
        { name: 'DrawAudio', path: '/' },
        { name: 'Example songs', path: '/examples/' },
        { name: info.example.name, path: info.path }
      ]),
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: info.title,
        url: absolute(info.path),
        description: info.description,
        isPartOf: { '@id': `${SITE.url}/#website` },
        about: { '@id': `${SITE.url}/#app` }
      }
    ]
  };
}
