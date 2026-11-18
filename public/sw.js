const CACHE_NAME = 'pickerwel-offline-v3';
const APP_SHELL_ASSETS = [
  '/',
  '/wheels',
  '/templates',
  '/groups',
  '/games',
  '/stopwatch',
  '/history',
  '/settings',
  '/scan',
  '/manifest.webmanifest',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.allSettled(APP_SHELL_ASSETS.map((url) => cache.add(url))))
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
  const isDevHost =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname.startsWith('ais-dev-');

  // Skip Firestore / Google Identity API live requests (handled by Firestore IndexedDB persistence)
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.pathname.startsWith('/api/')
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

  // In dev server, bypass SW cache for Next.js webpack chunks and RSC payloads to avoid chunk mismatch errors
  if (isDevHost && (url.pathname.startsWith('/_next/') || url.searchParams.has('_rsc'))) {
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
