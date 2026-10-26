/* Service worker: precache the app shell at install, cache-first for assets, network-first for pages.
   The build rewrites the placeholders below (see vite.config.js). */
const BUILD = 'mvpsylmt';
const CACHE = `passivo-${BUILD}`;
const PRECACHE = ["./","./assets/baby-CNnk39Th.webp","./assets/baby@2x-CoFybstD.webp","./assets/board-premium-D96jiBxS.webp","./assets/celebrate-DHZVN_FV.webp","./assets/charity-Dv09fjVp.webp","./assets/charity@2x-Gs3yxi1y.webp","./assets/cook-BPd8yEBe.webp","./assets/cook@2x-BsaQPhNu.webp","./assets/driver-B6fqQrtX.webp","./assets/driver@2x-DyXrasWp.webp","./assets/engineer-C-b9xDA1.webp","./assets/engineer@2x-BxqaNjWE.webp","./assets/expense-BgF7Ty9K.webp","./assets/expense-family-BmICLEiz.webp","./assets/expense-family@2x-DRCs_BU7.webp","./assets/expense@2x-CooIbL7i.webp","./assets/hammock-6CzCleqh.webp","./assets/hammock@2x-DInAgmrP.webp","./assets/index-B5qyq9Ch.js","./assets/index-BM-k6C1y.css","./assets/index-tHuUyr-j.js","./assets/lawyer-D7ExHoQf.webp","./assets/lawyer@2x-DlFtGTAG.webp","./assets/market-BIoXF7_M.webp","./assets/market@2x-D-ZUEQT-.webp","./assets/maxifox-logo-alpha-1x-C8Qwfj6n.webp","./assets/maxifox-logo-alpha-2x-BTQZ1b04.webp","./assets/nurse-VCY3affV.webp","./assets/nurse@2x-BtqGuM-Q.webp","./assets/opportunity-BAZb5CL1.webp","./assets/opportunity@2x-XctodWST.webp","./assets/payday-DXTjSQOH.webp","./assets/payday@2x-CLt_M18S.webp","./assets/police-DsCRM0-T.webp","./assets/police@2x-C0I8GCNQ.webp","./assets/ponder-njarNe4y.webp","./assets/programmer-Bu-CwmUX.webp","./assets/programmer@2x-BuFJo6hE.webp","./assets/report-DibEwec9.js","./assets/roll-DBOCXkw0.webp","./assets/roll@2x-BHCGmCv4.webp","./assets/rubik-hebrew-400-normal-Dp0lvSRB.woff2","./assets/rubik-hebrew-500-normal-B_5jqoVI.woff2","./assets/rubik-hebrew-700-normal-Da14F88e.woff2","./assets/rubik-hebrew-900-normal-CNJSgxQA.woff2","./assets/rubik-latin-400-normal-j0pmKyiQ.woff2","./assets/rubik-latin-500-normal-1os41rQk.woff2","./assets/rubik-latin-700-normal-D-tMm-eS.woff2","./assets/rubik-latin-900-normal-Cz6GdZLE.woff2","./assets/tax-audit-CT96tn9A.webp","./assets/tax-audit@2x-BdzYHMNd.webp","./assets/teacher-Cy0_5V1h.webp","./assets/teacher@2x-BSdYAWkH.webp","./assets/think-Be-VFxVV.webp","./assets/tip-B-a6yx52.webp","./assets/tip@2x-BWvr_Qps.webp","./assets/tired-CuiaP9_L.webp","./assets/tired@2x-BMfxRApL.webp","./assets/wave-BiBO1Ywk.webp","./assets/wave@2x-4B9N7sF8.webp","./assets/worried-DmMBf0M-.webp","./icons/apple-touch-icon.png","./icons/favicon-32.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./index.html","./manifest.webmanifest","./robots.txt"];

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
