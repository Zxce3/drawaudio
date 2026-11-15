// Checks the built site (run `bun run build` first): every page needs a unique title and description of a sensible
// length, a canonical URL on the site, Open Graph tags with an absolute image, exactly one h1, valid JSON-LD,
// and a place in the sitemap.  Usage: bun scripts/audit-seo.ts
import fs from 'node:fs';
import path from 'node:path';

const BUILD = path.resolve(import.meta.dir, '../build');
const SITE = 'https://drawaudio.zxce3.net';
const problems: string[] = [];
const warn = (page: string, msg: string) => problems.push(`${page}: ${msg}`);

const pages: string[] = [];
const walk = (dir: string) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === 'index.html') pages.push(full);
  }
};
walk(BUILD);

const sitemap = fs.readFileSync(path.join(BUILD, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const titles = new Map<string, string>();
const descriptions = new Map<string, string>();

for (const file of pages) {
  const rel = '/' + path.relative(BUILD, path.dirname(file)).replace(/\\/g, '/');
  const url = rel === '/' ? '/' : rel + '/';
  const html = fs.readFileSync(file, 'utf8');
  const get = (re: RegExp) => html.match(re)?.[1];
  const title = get(/<title>([^<]*)<\/title>/);
  const description = get(/<meta name="description" content="([^"]*)"/);
  const canonical = get(/<link rel="canonical" href="([^"]*)"/);

  if (!title) warn(url, 'missing <title>');
  else {
    if (title.length > 65) warn(url, `title is ${title.length} characters (keep it under about 60)`);
    if (titles.has(title)) warn(url, `duplicate title with ${titles.get(title)}`);
    titles.set(title, url);
  }
  if (!description) warn(url, 'missing meta description');
  else {
    if (description.length < 70 || description.length > 165) warn(url, `description is ${description.length} characters (aim for 70 to 160)`);
    if (descriptions.has(description)) warn(url, `duplicate description with ${descriptions.get(description)}`);
    descriptions.set(description, url);
  }
  if (canonical !== `${SITE}${url}`) warn(url, `canonical is "${canonical}", expected "${SITE}${url}"`);
  if (!sitemapUrls.includes(`${SITE}${url}`)) warn(url, 'not listed in sitemap.xml');
  if (!/<meta name="robots" content="index/.test(html)) warn(url, 'missing robots index meta');
  for (const prop of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type', 'og:site_name']) {
    if (!html.includes(`property="${prop}"`)) warn(url, `missing ${prop}`);
  }
  const ogImage = get(/property="og:image" content="([^"]*)"/);
  if (ogImage && !ogImage.startsWith('https://')) warn(url, `og:image is not absolute: ${ogImage}`);
  if (!html.includes('name="twitter:card"')) warn(url, 'missing twitter:card');
  const h1s = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1s !== 1) warn(url, `${h1s} h1 elements (want exactly 1)`);
  if (!/<html lang="en"/.test(html)) warn(url, 'missing html lang');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
  if (!blocks.length) warn(url, 'no JSON-LD');
  for (const block of blocks) {
    try {
      const data = JSON.parse(block[1]);
      if (!data['@type']) warn(url, 'JSON-LD without @type');
    } catch {
      warn(url, 'invalid JSON-LD');
    }
  }
}

for (const loc of sitemapUrls) {
  const rel = loc.replace(SITE, '');
  if (!fs.existsSync(path.join(BUILD, rel, 'index.html'))) warn(loc, 'in the sitemap but not built');
}
const robots = fs.readFileSync(path.join(BUILD, 'robots.txt'), 'utf8');
if (!robots.includes(`${SITE}/sitemap.xml`)) problems.push('robots.txt does not point to the sitemap');
if (!fs.existsSync(path.join(BUILD, 'og-image.png'))) problems.push('og-image.png is missing');

console.log(`Checked ${pages.length} pages and ${sitemapUrls.length} sitemap URLs.`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('SEO audit passed.');
