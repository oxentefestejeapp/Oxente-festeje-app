/**
 * Service Worker for Oxente Festeje
 * Handles Web Push notifications and Mobile App Badging in background.
 * Network-only pass-through: NEVER locks stale asset caches.
 */

const SW_VERSION = 'v5-resilient-mobile-push';

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

// Push Event: Received when Supabase Webhook or Backend sends a notification with app closed
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    try {
      data = {
        title: 'Oxente Festeje',
        body: event.data ? event.data.text() : 'Novo pedido registrado!'
      };
    } catch {
      data = {};
    }
  }

  const title = data.title || '🛍️ Novo Pedido Registrado!';
  const messageBody = data.body || 'Um novo pedido acabou de entrar no sistema.';
  const count = Number(data.badgeCount || data.unreadCount || 1);

  // 1. Update App Badge on Mobile Icon (Android / iOS PWA)
  try {
    if ('setAppBadge' in self.navigator) {
      self.navigator.setAppBadge(count).catch(() => {});
    } else if ('setExperimentalAppBadge' in self.navigator) {
      self.navigator.setExperimentalAppBadge(count).catch(() => {});
    }
  } catch {}

  // 2. Display Native Mobile Notification Banner
  // Gera uma tag única para cada notificação recebida, garantindo que o Android e iOS acumulem na tela de bloqueio
  const uniqueStamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const notificationTag = data.tag || `oxente-${data.orderId || 'notif'}-${uniqueStamp}`;
  const targetUrl = data.url || '/?tab=vendas';

  // Primary options optimized for mobile devices (using PNG raster icons)
  const primaryOptions = {
    body: messageBody,
    icon: '/pwa-192x192.png',
    badge: '/badge-96.png',
    vibrate: [250, 100, 250, 100, 250],
    tag: notificationTag,
    renotify: true,
    data: {
      url: targetUrl,
      orderId: data.orderId || null,
      timestamp: Date.now()
    }
  };

  // Safe execution with fallback: if advanced options fail on iOS or strict Android,
  // fall back to ultra-compatible format so the notification is NEVER LOST!
  const showNotificationSafe = async () => {
    try {
      await self.registration.showNotification(title, primaryOptions);
    } catch (err1) {
      console.warn('[SW Push] Tentando formato simplificado para compatibilidade máxima:', err1);
      try {
        await self.registration.showNotification(title, {
          body: messageBody,
          icon: '/pwa-192x192.png',
          tag: notificationTag,
          data: { url: targetUrl }
        });
      } catch (err2) {
        console.error('[SW Push] Fallback elementar de notificação:', err2);
        await self.registration.showNotification(title, {
          body: messageBody
        });
      }
    }
  };

  event.waitUntil(showNotificationSafe());
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

