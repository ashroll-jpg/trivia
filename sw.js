// Tally offline support + automatic updates.
// The version below changes with every release so phones pick up the new files.
const VERSION = "liftlog-2.2.0";
const CORE = [
  "./", "./index.html", "./manifest.json",
  "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png",
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(CORE.map(u => c.add(new Request(u, {cache: "reload"}))))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Update checks always go straight to the network.
  if (url.searchParams.has("fresh")) return;

  // The app page: always ask GitHub for the newest copy first, fall back to the saved one offline.
  if (req.mode === "navigate"){
    e.respondWith(
      fetch(req.url, {cache: "no-cache"}).then(res => {
        if (res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put("./index.html", copy)); }
        return res;
      }).catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // Everything else (charts library, fonts, icons): saved copy first, then network.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && (res.ok || res.type === "opaque")){
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});
