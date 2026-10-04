// ============================================================================
// Service Worker v7 — High-Performance Caching & Offline Engine
// ============================================================================

const CACHE_NAME = 'kk-tourism-v7';
const ASSET_CACHE_NAME = 'kk-assets-v7';
const FONT_CACHE_NAME = 'kk-fonts-v7';
const IMAGE_CACHE_NAME = 'kk-images-v7';

const CURRENT_CACHES = [CACHE_NAME, ASSET_CACHE_NAME, FONT_CACHE_NAME, IMAGE_CACHE_NAME];

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/robots.txt'
];

const IMAGE_HOSTS = ['images.pexels.com', 'images.unsplash.com', 'source.unsplash.com'];

// 1. Install Event — Precache core shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

// 2. Activate Event — Immediately prune legacy caches (v6, v5, etc.) and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (!CURRENT_CACHES.includes(cache)) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event — Multi-tier specialized caching strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ignore non-http schemes (extensions, data:, etc.)
  if (!url.protocol.startsWith('http')) return;

  // A. Google Fonts — Cache-First (Fonts never change)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const res = await fetch(event.request);
          if (res.status === 200 || res.type === 'opaque') {
            cache.put(event.request, res.clone());
          }
          return res;
        } catch {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // B. Images (Pexels, Unsplash, local images) — Cache-First with background populate
  if (IMAGE_HOSTS.includes(url.hostname) || event.request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
        const cachedImage = await cache.match(event.request);
        if (cachedImage) return cachedImage;

        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.status === 200 || networkResponse.type === 'opaque') {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          return cachedImage || Response.error();
        }
      })
    );
    return;
  }

  // C. Vite Hashed Assets (/assets/*) — Cache-First (Hashed filenames are 100% immutable)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSET_CACHE_NAME).then(async (cache) => {
        const cachedAsset = await cache.match(event.request);
        if (cachedAsset) return cachedAsset;

        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          return cachedAsset || Response.error();
        }
      })
    );
    return;
  }

  // Exclude non-same-origin API calls from HTML/page handler
  if (url.origin !== self.location.origin) {
    return;
  }

  // D. HTML Navigation & Entry Shell — Network-First so users always get the freshest deployment
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((res) => res || Response.error()))
    );
    return;
  }

  // E. Fallback for other same-origin assets — Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// 4. Message listener for immediate skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
