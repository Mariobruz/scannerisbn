// Service worker minimal - no cache per index.html
const CACHE_NAME = 'scannerisbn-v3';

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Non fare mai cache - sempre dalla rete
self.addEventListener('fetch', event => {
    event.respondWith(fetch(event.request));
});
