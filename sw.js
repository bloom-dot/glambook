const CACHE_NAME = 'glambook-v26';
const OFFLINE = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors connexion — GlamBook</title></head>'
  + '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0E0E10;color:#F4F2F5;font-family:system-ui,sans-serif;text-align:center;padding:24px">'
  + '<div><p style="font-weight:800;letter-spacing:.06em;font-size:1.4rem;margin:0 0 12px">GLAM<span style="color:#D4AF37">BOOK</span></p>'
  + '<p style="margin:0 0 20px;color:#A8A2AC">Pas de connexion internet pour le moment.</p>'
  + '<button onclick="location.reload()" style="background:#D4AF37;color:#17120A;border:0;border-radius:8px;padding:12px 22px;font-weight:700;cursor:pointer">Réessayer</button></div></body></html>';
const ASSETS = [
  '/',
  '/index.html',
  '/artists.html',
  '/css/main.css',
  '/js/supabase.js',
  '/js/utils.js',
  '/js/nav.js',
  '/js/select.js',
  '/js/shell.js',
  '/js/rdv.js',
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
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Ne pas intercepter les requêtes externes/non-HTTP
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
  if (url.hostname.includes('supabase') ||
      url.hostname.includes('stripe') ||
      url.hostname.includes('vercel.live') ||
      url.hostname.includes('pusher') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com') ||
      url.hostname.includes('data.gouv.fr') ||   // recherche d'adresses : toujours en direct, jamais en cache
      url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-first pour les pages HTML
  if (e.request.mode === 'navigate') {
    e.respondWith(
      // Hors connexion : une page simple plutôt que l'accueil (dont les modules échoueraient)
      fetch(e.request).catch(() => new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
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
