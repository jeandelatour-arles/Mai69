// Mai 69 — service worker : tout en cache, aucune requête réseau ensuite.
const VERSION = 'mai69-v2';
const FILES = [
  './',
  "./css/app.css",
  "./icons/apple-touch-icon.png",
  "./icons/favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/logo-mai69.svg",
  "./icons/maskable-512.png",
  "./index.html",
  "./js/app.js",
  "./js/core/endConditions.js",
  "./js/core/score.js",
  "./js/core/search.js",
  "./js/core/stats.js",
  "./js/data/db.js",
  "./js/i18n/en.js",
  "./js/i18n/fr.js",
  "./js/i18n/i18n.js",
  "./js/ui/dom.js",
  "./js/ui/game.js",
  "./js/ui/gestures.js",
  "./js/ui/newgame.js",
  "./js/ui/panels.js",
  "./js/ui/sheet.js",
  "./js/ui/state.js",
  "./manifest.webmanifest",
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
