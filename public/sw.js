/**
 * Self-Destructing Service Worker for Oxente Festeje
 * Unregisters itself, clears all cache storage, and forces a full reload to get the latest version.
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            return caches.delete(cacheName);
          })
        );
      })
      .then(() => self.registration.unregister())
      .then(() => self.clients.claim())
      .then(() => {
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            if (client.url && 'navigate' in client) {
              client.navigate(client.url).catch(() => {});
            }
          });
        });
      })
  );
});

// Pass-through fetch handler in case it takes a moment to unregister fully
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
