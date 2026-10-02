/* Don't Skip Brain Day — service worker
   Goal: always load the newest app when online, still work offline.

   Strategy:
   - App document  -> NETWORK-FIRST (newest wins online; cached copy offline)
   - Google Fonts  -> stale-while-revalidate (fast + offline after first load)
   - icons/manifest-> cache-first
   - opentdb API   -> pass through (network only; not cached)

   To ship an app update: just push the new index.html — online users get it
   immediately. Bump VERSION below only if you change this file or want to
   force old caches to be cleared.
*/
const VERSION = "brainday-v3";
const CORE = ["./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(CORE);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const isFont = (u) => u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com";

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App document — network-first, fall back to cached shell offline
  if (req.mode === "navigate" || (url.origin === location.origin && url.pathname.endsWith("/index.html"))) {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        const c = await caches.open(VERSION);
        c.put("./index.html", net.clone());
        return net;
      } catch (_) {
        const c = await caches.open(VERSION);
        return (await c.match("./index.html")) || Response.error();
      }
    })());
    return;
  }


  // Google Fonts — stale-while-revalidate
  if (isFont(url)) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const cached = await c.match(req);
      const netP = fetch(req).then(r => { c.put(req, r.clone()); return r; }).catch(() => null);
      return cached || (await netP) || Response.error();
    })());
    return;
  }

  // Other same-origin files (icons, manifest) — cache-first
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const cached = await c.match(req);
      if (cached) return cached;
      try { const net = await fetch(req); c.put(req, net.clone()); return net; }
      catch (_) { return Response.error(); }
    })());
    return;
  }

  // opentdb API and anything else: let the network handle it (no caching)
});
