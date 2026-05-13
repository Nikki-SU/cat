const CACHE_NAME = 'cat-v1';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/cat.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE_NAME).map(caches.delete)))); self.clients.claim(); });
self.addEventListener('fetch', (e) => { if (e.request.url.includes('/api/')) return; e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(nr => { if (nr.status === 200) { const rc = nr.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, rc)); } return nr; }))); });
