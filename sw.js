const CACHE_NAME = 'glambook-v9';
const ASSETS = [
  '/',
  '/index.html',
  '/artists.html',
  '/css/main.css',
  '/js/supabase.js',
  '/js/utils.js',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Ne pas intercepter les requêtes externes/non-HTTP
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
  if (url.hostname.includes('supabase') ||
      url.hostname.includes('stripe') ||
      url.hostname.includes('vercel.live') ||
      url.hostname.includes('pusher') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com') ||
      url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-first pour les pages HTML
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Network-first pour JS et CSS (évite un thème/style figé en cache), cache-first pour le reste
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
        }
        return res;
      });
    })
  );
});
