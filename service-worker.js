const CACHE_NAME = 'chess-arena-cache-v2';
const ASSETS = [
  '.',
  'index.html',
  'manifest.json',
  'css/style.css',
  'css/theme.css',
  'css/board.css',
  'css/responsive.css',
  'js/ui.js',
  'js/game.js',
  'js/timer.js',
  'js/ai.js',
  'js/notification.js',
  'assets/images/favicon.png'
];

self.addEventListener('install', event => {
  // Force the new service worker to activate immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
