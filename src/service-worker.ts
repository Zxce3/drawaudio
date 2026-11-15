/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `drawaudio-${version}`;

// Everything the app needs: built JS/CSS, static files (impulse responses, icons) and the prerendered page
const ASSETS = [...new Set([...build, ...files, ...prerendered])];

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
    // No skipWaiting here: the page offers "Reload" so an update never swaps code mid-song
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await sw.clients.claim();
      for (const client of await sw.clients.matchAll()) client.postMessage({ type: 'OFFLINE_READY' });
    })()
  );
});

sw.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') sw.skipWaiting();
});

sw.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);

      // Built assets are content-hashed and static files are versioned with the cache: cache first
      const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') cache.put(request, response.clone());
        return response;
      } catch (error) {
        // Offline and not cached: any page request gets the app shell
        if (request.mode === 'navigate') {
          const shell = (await cache.match('/')) ?? (await cache.match(new URL('./', sw.registration.scope).pathname));
          if (shell) return shell;
        }
        throw error;
      }
    })()
  );
});
