import { SITE } from '$lib/seo';
import { ALL_EXAMPLES } from '$lib/examples';

export const prerender = true;

export function GET() {
  // lastmod is the build date: the site is rebuilt and deployed on every release
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    { loc: '/examples/', priority: '0.8', changefreq: 'weekly' },
    ...ALL_EXAMPLES.map((info) => ({ loc: info.path, priority: '0.6', changefreq: 'monthly' }))
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => `  <url>\n    <loc>${SITE.url}${u.loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`)
  .join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
