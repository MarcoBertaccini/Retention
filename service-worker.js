// service-worker.js — Il tuo Salone (by Zenith Studio)
// Cache strategy: network-first per il documento HTML, cache-first per gli asset statici.
// CRITICO: i webhook n8n NON vengono mai cacheati (sempre network, fail-fast).

const CACHE_NAME = 'zenith-salone-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-180.png'
];

// Domini esplicitamente esclusi dalla cache (sempre network)
const BYPASS_HOSTS = [
  'n8n.zenith-studio.it'
];

// Domini statici cacheabili (fonts, FullCalendar CDN)
const STATIC_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return; // POST/PUT/etc. sempre passano

  const url = new URL(req.url);

  // ── BYPASS esplicito per webhook n8n e qualsiasi cosa con auth ──
  if (BYPASS_HOSTS.includes(url.hostname)) return;
  if (req.headers.get('authorization')) return;

  // ── Static fonts/cdn: cache-first ──
  if (STATIC_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // ── Same-origin HTML/asset: network-first, fallback cache ──
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  // ── Altri origin (no policy match): passa diretto ──
});
