const CACHE_NAME = 'civilpyq-offline-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET' || !url.pathname.startsWith('/pdfs/')) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        return await fetch(event.request);
      } catch {
        return new Response('This file is not available offline.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
    })
  );
});
