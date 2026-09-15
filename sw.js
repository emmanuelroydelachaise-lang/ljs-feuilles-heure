const CACHE = 'ljs-heures-v11';
const ASSETS = ['./','./index.html','./styles.css','./config.js','./app-1.js','./app-2.js','./app-3.js','./app-4.js','./app-5.js','./app-6.js','./manifest.webmanifest','./brand.svg','./print-template.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request)));
});
