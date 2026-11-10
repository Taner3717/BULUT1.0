// Çevrimdışı çalışma: uygulama dosyaları önbellekten, yeni sürüm arka planda güncellenir.
const CACHE = 'bulut-v5';
const ASSETS = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/coach.js', 'js/training.js', 'js/storage.js', 'js/plan.js', 'js/photos.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Stale-while-revalidate
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const cached = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => cached);
    return cached || net;
  }));
});
