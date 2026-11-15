import { expect, test } from 'bun:test';
import { HOME_DESCRIPTION, HOME_TITLE, SITE, absolute, jsonLdScript, resolveSeo, webApplicationLd } from '../src/lib/seo';
import { ALL_EXAMPLES, examplesSeo, exampleSeo } from '../src/lib/examples';

test('home title and description are a sensible length', () => {
  expect(HOME_TITLE.length).toBeLessThanOrEqual(60);
  expect(HOME_DESCRIPTION.length).toBeGreaterThanOrEqual(70);
  expect(HOME_DESCRIPTION.length).toBeLessThanOrEqual(160);
});

test('URLs are absolute and canonical paths end with a slash', () => {
  expect(absolute('/og-image.png')).toBe(`${SITE.url}/og-image.png`);
  expect(absolute('https://example.com/x')).toBe('https://example.com/x');
  const seo = resolveSeo({ title: 't', description: 'd', path: '/examples/' });
  expect(seo.canonical).toBe(`${SITE.url}/examples/`);
  expect(seo.image.startsWith('https://')).toBe(true);
  expect(seo.robots).toContain('index');
  expect(resolveSeo({ title: 't', description: 'd', path: '/', noindex: true }).robots).toContain('noindex');
});

test('every example page has a unique, well-sized title and description', () => {
  const pages = [...ALL_EXAMPLES.map(exampleSeo), examplesSeo()];
  expect(new Set(pages.map((p) => p.title)).size).toBe(pages.length);
  expect(new Set(pages.map((p) => p.description)).size).toBe(pages.length);
  for (const page of pages) {
    expect(page.title.length).toBeLessThanOrEqual(65);
    expect(page.description.length).toBeGreaterThanOrEqual(70);
    expect(page.description.length).toBeLessThanOrEqual(165);
    expect(page.path.startsWith('/') && page.path.endsWith('/')).toBe(true);
  }
});

test('JSON-LD can never close its own script tag', () => {
  const tag = jsonLdScript({ name: '</script><script>alert(1)</script>' });
  expect(tag.match(/<\/script>/g)?.length).toBe(1);
  expect(JSON.parse(tag.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')).name).toContain('script');
  expect((webApplicationLd() as { '@type': string })['@type']).toBe('WebApplication');
});
