/**
 * Service Worker for Oxente Festeje
 * Handles Web Push notifications and Mobile App Badging in background.
 * Network-only pass-through: NEVER locks stale asset caches.
 */

const SW_VERSION = 'v2-push-badge';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Clean up old stale caches if any existed previously
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

// Network-only pass-through: fetch requests always go directly to the network
// This prevents cache lockup bugs while allowing background push & badging
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// Push Event: Received when Supabase Webhook sends a new order alert
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = {
      title: 'Oxente Festeje',
      body: event.data ? event.data.text() : 'Novo pedido registrado!'
    };
  }

  const title = data.title || '🛍️ Novo Pedido Registrado!';
  const messageBody = data.body || 'Um novo pedido acabou de entrar no sistema.';
  const count = Number(data.badgeCount || data.unreadCount || 1);

  // 1. Update App Badge on Mobile Icon (Android / iOS PWA)
  if ('setAppBadge' in self.navigator) {
    self.navigator.setAppBadge(count).catch(() => {});
  } else if ('setExperimentalAppBadge' in self.navigator) {
    self.navigator.setExperimentalAppBadge(count).catch(() => {});
  }

  // 2. Display Native Mobile Notification Banner
  const options = {
    body: messageBody,
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'oxente-order-notification',
    renotify: true,
    data: {
      url: data.url || '/?tab=vendas',
      orderId: data.orderId || null,
      timestamp: Date.now()
    },
    actions: [
      { action: 'open_order', title: 'Ver Pedido' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click: User taps on the push banner on mobile
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Clear badge on icon
  if ('clearAppBadge' in self.navigator) {
    self.navigator.clearAppBadge().catch(() => {});
  } else if ('clearExperimentalAppBadge' in self.navigator) {
    self.navigator.clearExperimentalAppBadge().catch(() => {});
  }

  const targetUrl = event.notification.data?.url || '/?tab=vendas';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl).catch(() => {});
          }
          return client.focus();
        }
      }
      // If app was fully closed, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

