/**
 * Ready — service worker
 *
 * Two jobs: make the app open with no network, and never serve stale code.
 *
 * The page itself is fetched network-first, so a fresh version shows up as
 * soon as you reload while online, with the cached copy used only when the
 * network fails. That costs one small request on launch and removes the
 * whole class of "I updated it but I'm still seeing the old one" problem.
 * Icons and the manifest are cache-first, since they rarely change.
 *
 * Bump VERSION whenever the shell changes. Old caches are deleted on
 * activation.
 */

const VERSION = 'ready-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      // cache: 'reload' stops the browser filling the cache from its own
      // stale HTTP cache during install.
      .then(cache => cache.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('shell precache incomplete', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function isHtml(request) {
  return request.mode === 'navigate' ||
    (request.headers.get('Accept') || '').includes('text/html');
}

self.addEventListener('fetch', event => {
  const request = event.request;

  // Never touch anything but plain GETs from our own origin. The API lives
  // on another host, and caching or replaying a task change would be a way
  // to lose or duplicate data.
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (isHtml(request)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(VERSION).then(cache => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() =>
          caches.match(request).then(hit => hit || caches.match('./index.html'))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(hit => {
      if (hit) return hit;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      });
    })
  );
});
