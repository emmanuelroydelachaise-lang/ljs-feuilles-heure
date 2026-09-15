const CACHE = 'ljs-heures-v18';
const ASSETS = ['./','./index.html','./styles.css','./print-vector.css','./config.js','./app-1.js','./app-2.js','./app-3.js','./app-4.js','./app-5.js','./app-6.js','./admin-reset.js','./ui-labels.js','./admin-projects.js','./interim-agency.js','./pwa-install.js','./manifest.webmanifest','./logo-ljs-v2.png','./icon-192-v2.png','./icon-512-v2.png','./print-template.svg'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r && r.ok) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return r;
    }).catch(() => caches.match(e.request))
  );
});
