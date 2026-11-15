import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
		// Registered by hand in src/lib/pwa.svelte.ts so the page can offer "Reload" on updates
		serviceWorker: { register: false },
		prerender: { entries: ['*', '/sitemap.xml'] }
	}
};

export default config;
