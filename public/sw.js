const CACHE_NAME = 'pickerwel-offline-v6';
const APP_SHELL_ASSETS = [
  '/',
  '/wheels',
  '/forms',
  '/templates',
  '/groups',
  '/tasks',
  '/games',
  '/stopwatch',
  '/history',
  '/github',
  '/settings',
  '/scan',
  '/manifest.webmanifest',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
];

const isDevHostName = (hostname) =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname.startsWith('ais-dev-');

self.addEventListener('install', (event) => {
  const devHost = isDevHostName(self.location.hostname);
  const assetsToPrecache = devHost
    ? ['/manifest.webmanifest', '/icon.svg', '/pwa-192x192.png', '/pwa-512x512.png', '/apple-touch-icon.png']
    : APP_SHELL_ASSETS;
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.allSettled(assetsToPrecache.map((url) => cache.add(url))))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isDevHost = isDevHostName(url.hostname);

  // Skip Firestore / Google Identity API live requests (handled by Firestore IndexedDB persistence)
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // In dev server, bypass SW cache for navigation, Next.js webpack chunks, and RSC payloads to prevent ChunkLoadError
  if (
    isDevHost &&
    (request.mode === 'navigate' || url.pathname.startsWith('/_next/') || url.searchParams.has('_rsc'))
  ) {
    return;
  }

  // Navigation requests: Network-first with offline cached shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          const cachedRoot = await caches.match('/');
          return cachedRoot || Response.error();
        })
    );
    return;
  }

  // Static assets, fonts, and Next.js chunks: Stale-While-Revalidate
  if (
    url.origin === self.location.origin ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});
