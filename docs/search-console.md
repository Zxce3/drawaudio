# Search Console and Bing Webmaster setup

The site is ready for search engines: every page has a canonical URL, a sitemap is generated at build time
(`https://drawaudio.zxce3.net/sitemap.xml`), and `robots.txt` points to it. What is left needs your Google account,
so it is a one-time checklist.

## 1. Verify ownership (Google)

1. Open [Google Search Console](https://search.google.com/search-console) and choose **Add property**.
2. Pick **URL prefix** and enter `https://drawaudio.zxce3.net/`.
3. Choose the **HTML tag** method. Copy only the value of `content="..."` (the token).
4. In the GitHub repo go to **Settings → Secrets and variables → Actions → Variables** and create a repository variable
   named `GOOGLE_SITE_VERIFICATION` with that token.
5. Run the **Deploy to GitHub Pages** workflow again (Actions → Run workflow). The build adds
   `<meta name="google-site-verification" ...>` to the home page.
6. Back in Search Console press **Verify**.

Other ways, if you prefer: add the `google<token>.html` file Google gives you to `static/`, or verify a **Domain**
property with a DNS TXT record (the domain's DNS is on Cloudflare, so this is a copy and paste there).

## 2. Submit the sitemap

In Search Console open **Sitemaps** and submit `sitemap.xml`. It lists the home page, `/examples/` and the 21 example
song pages. Google reports how many were discovered.

## 3. Ask for indexing of the key pages

Use **URL inspection** on these, then **Request indexing**:

- `https://drawaudio.zxce3.net/`
- `https://drawaudio.zxce3.net/examples/`

The other pages are found through the sitemap and the links between them.

## 4. Bing and others

In [Bing Webmaster Tools](https://www.bing.com/webmasters) choose **Import from Google Search Console**. If you
verify directly, put the token in a repository variable called `BING_SITE_VERIFICATION`. Bing results also feed
DuckDuckGo and other engines.

## 5. After a few weeks

- **Pages** report: every page should be "Indexed". Reasons for "Discovered, currently not indexed" mean Google is just waiting.
- **Core Web Vitals**: needs real-user data, which appears after enough visits.
- **Performance**: which searches show the site. Examples pages are the ones to watch for long-tail searches.

## Notes

- The domain is served through Cloudflare, which adds its own managed block to `robots.txt` (it only restricts AI
  training crawlers). Search crawlers such as Googlebot and Bingbot are allowed.
- `bun run audit:seo` (also run in CI) fails the build if a page loses its title, description, canonical URL, `h1`,
  structured data or sitemap entry.
