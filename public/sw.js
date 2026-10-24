// Shagufta POS Service Worker
const CACHE_NAME = 'shagufta-pos-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/hotel%20logo.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('Pre-cache asset warning:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Strictly pass-through non-GET requests and all Supabase / realtime / external API traffic
  if (
    req.method !== 'GET' ||
    url.pathname.includes('/rest/') ||
    url.pathname.includes('/auth/') ||
    url.pathname.includes('/realtime/') ||
    url.protocol.startsWith('ws') ||
    url.hostname.includes('supabase.co')
  ) {
    return;
  }

  // Network-first for same-origin document and assets with cache fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          if (req.mode === 'navigate') {
            return (await caches.match('/index.html')) || Response.error();
          }
          return Response.error();
        })
    );
  }
});
