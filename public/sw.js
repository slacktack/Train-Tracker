// Offline shell: static assets cache-first, pages and API network-first with last-good fallback.
const STATIC = 'tt-static-v1';
// v2 drops v1, which could hold PNR lookups.
const RUNTIME = 'tt-runtime-v2';
const PRIVATE = /^\/(api\/)?pnr\//;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![STATIC, RUNTIME].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function networkFirst(req, cacheName, timeoutMs, honorNoStore = false) {
  const cache = await caches.open(cacheName);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), timeoutMs)),
    ]);
    if (res.ok && !(honorNoStore && /no-store/.test(res.headers.get('Cache-Control') || ''))) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw new Error('offline');
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    if (PRIVATE.test(url.pathname)) return;
    if (url.pathname.startsWith('/_next/static/') || /\.(woff2?|png|jpg|svg|ico)$/.test(url.pathname)) {
      e.respondWith(
        caches.open(STATIC).then(async (c) => {
          const hit = await c.match(req);
          if (hit) return hit;
          const res = await fetch(req);
          if (res.ok) c.put(req, res.clone());
          return res;
        }),
      );
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname.startsWith('/api/health')) return;
      e.respondWith(networkFirst(req, RUNTIME, 8000, true).catch(() => new Response(JSON.stringify({ error: 'offline', code: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
      return;
    }
    if (req.mode === 'navigate') {
      e.respondWith(networkFirst(req, RUNTIME, 4000).catch(async () => (await caches.match('/')) || new Response('Offline', { status: 503 })));
      return;
    }
  }
  // map tiles and glyphs: keep what the user has already seen
  if (/maptiler\.com/.test(url.hostname)) {
    e.respondWith(
      caches.open('tt-tiles-v1').then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req).then((res) => {
          if (res.ok) c.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || net;
      }),
    );
  }
});
