const CACHE_NAME = 'chess-arena-cache-v1';
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
  'assets/images/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
