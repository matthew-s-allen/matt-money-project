/* ============================================================
   MATT MONEY — Service Worker (Offline Support)
   ============================================================ */

const CACHE_NAME = 'matt-money-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/utils/formatter.js',
  '/js/utils/storage.js',
  '/js/api.js',
  '/js/views/dashboard.js',
  '/js/views/add-transaction.js',
  '/js/views/transactions.js',
  '/js/views/simulator.js',
  '/js/views/patrimonio.js',
  '/js/app.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS.filter(url => !url.startsWith('https://fonts'))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache Apps Script API calls or Gemini API
  if (url.hostname.includes('script.google.com') || url.hostname.includes('generativelanguage.googleapis.com')) {
    return; // network only
  }

  // Cache-first for static assets
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => {
          // Offline fallback for navigation
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
    );
  }
});
