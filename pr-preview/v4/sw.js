/* Service worker: precache the app shell at install, cache-first for assets, network-first for pages.
   The build rewrites the placeholders below (see vite.config.js). */
const BUILD = 'mvkwrn17';
const CACHE = `passivo-${BUILD}`;
const PRECACHE = ["./","./assets/celebrate-DHZVN_FV.webp","./assets/hammock-6CzCleqh.webp","./assets/hammock@2x-DInAgmrP.webp","./assets/index-BMqnClP1.js","./assets/index-C-cLcPp_.js","./assets/index-CsIKuS0a.css","./assets/ponder-njarNe4y.webp","./assets/report-kMO2ao0b.js","./assets/roll-DBOCXkw0.webp","./assets/roll@2x-BHCGmCv4.webp","./assets/rubik-hebrew-400-normal-Dp0lvSRB.woff2","./assets/rubik-hebrew-500-normal-B_5jqoVI.woff2","./assets/rubik-hebrew-700-normal-Da14F88e.woff2","./assets/rubik-hebrew-900-normal-CNJSgxQA.woff2","./assets/rubik-latin-400-normal-j0pmKyiQ.woff2","./assets/rubik-latin-500-normal-1os41rQk.woff2","./assets/rubik-latin-700-normal-D-tMm-eS.woff2","./assets/rubik-latin-900-normal-Cz6GdZLE.woff2","./assets/think-Be-VFxVV.webp","./assets/tip-B-a6yx52.webp","./assets/tip@2x-BWvr_Qps.webp","./assets/tired-CuiaP9_L.webp","./assets/tired@2x-BMfxRApL.webp","./assets/wave-BiBO1Ywk.webp","./assets/wave@2x-4B9N7sF8.webp","./assets/wordmark-BmuhzNtc.svg","./assets/worried-DmMBf0M-.webp","./icons/apple-touch-icon.png","./icons/favicon-32.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./index.html","./manifest.webmanifest","./robots.txt"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith('passivo-') || k.startsWith('etr-')) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('./', copy));
        return res;
      }).catch(() => caches.match('./').then((r) => r || caches.match('./index.html'))),
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});
