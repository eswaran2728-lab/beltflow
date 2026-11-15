// BeltFlow PWA Service Worker
const CACHE_NAME = 'beltflow-cache-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/beltflow-logo.png',
  // Fonts and icons are served from this site (no third-party requests).
  '/assets/vendor/lucide-0.469.0.min.js',
  '/assets/fonts/inter-latin-400-normal.woff2',
  '/assets/fonts/inter-latin-500-normal.woff2',
  '/assets/fonts/inter-latin-600-normal.woff2',
  '/assets/fonts/inter-latin-700-normal.woff2',
  '/assets/fonts/space-grotesk-latin-500-normal.woff2',
  '/assets/fonts/space-grotesk-latin-600-normal.woff2',
  '/assets/fonts/space-grotesk-latin-700-normal.woff2'
];

// Install Event - Pre-cache core app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[BeltFlow SW] Pre-caching offline app shell');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[BeltFlow SW] Failed to pre-cache some assets:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[BeltFlow SW] Removing old cache:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Stale-While-Revalidate with offline fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never cache personal data. API answers (accounts, students, payments,
  // messages) always come fresh from the server and are never stored here,
  // so nothing personal stays in the browser after sign-out. Requests to
  // other sites are left to the browser as well.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // For HTML navigations, try network first, fallback to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // For other assets, try cache first, then network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in background to revalidate
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch((error) => {
          console.warn('[BeltFlow SW] Fetch failed for:', event.request.url, error);
        });
    })
  );
});
