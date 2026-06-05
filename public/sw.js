/**
 * Service Worker for Oxente Festeje - PWA Support
 */

const CACHE_NAME = 'oxente-festeje-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// Instalação - Guardar chaves em cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE).catch(err => {
          console.warn('Opcional: Falha ao pré-carregar recursos', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação - Limpar caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              return caches.delete(cache);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch - Resposta imediata focada em rede com fallback offline
self.addEventListener('fetch', (event) => {
  // Ignorar requisições não GET ou esquemas como chrome-extension ou externos corporativos
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se a resposta é válida, atualiza o cache para uso futuro em caso de queda de rede
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback ao cache se a rede falhar
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Se não houver nada no cache, retorna opcionalmente index.html
          return caches.match('/');
        });
      })
  );
});
