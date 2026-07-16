/* Daily Cash & Bank Ledger - offline service worker
   ---------------------------------------------------------------------
   Upload this file into the SAME folder on GitHub as your ledger HTML
   file. It must sit next to it (same directory) for the registration
   in the HTML (`navigator.serviceWorker.register('./sw.js')`) to find it.

   Strategy: cache-first, falling back to the network, and every
   successful response (same-origin page, Google Fonts, the ExcelJS
   library from its CDN, etc.) is stored the moment it's fetched. After
   one normal online visit, everything the app needs is cached, so
   later visits - including with no internet at all - keep working.

   Bump CACHE_NAME (e.g. to 'ledger-cache-v2') any time you want
   previously cached files dropped and fetched fresh again - for
   example after uploading a meaningfully updated ledger HTML file.
   ------------------------------------------------------------------ */
const CACHE_NAME = 'ledger-cache-v1';

self.addEventListener('install', (event) => {
  // Take over immediately rather than waiting for the old worker (if
  // any) to finish - this is a single simple cache, no migration risk.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);

      const networkFetch = fetch(event.request)
        .then((response) => {
          // Cross-origin resources loaded without CORS (Google Fonts,
          // the ExcelJS CDN script) come back as "opaque" responses -
          // status is always 0 and can't be inspected, but they're
          // still safe to cache as-is for offline replay.
          const cacheable = response && (response.status === 200 || response.type === 'opaque');
          if (cacheable) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => cached); // offline, or a CDN is unreachable - use cache

      // Cache-first: instant load, and works with no network at all.
      // Still fetches in the background to keep the cache fresh for
      // next time whenever the device does have a connection.
      if (cached) {
        networkFetch.catch(() => {}); // refresh silently, ignore failures
        return cached;
      }
      return networkFetch;
    })
  );
});
