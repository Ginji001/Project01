const CACHE_NAME = 'hachiware-solitaire-v22';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=22',
  './app.js?v=22',
  './manifest.webmanifest',
  './icon.svg',
  './maskable.svg',
  './cards/S1.svg',
  './cards/S2.svg',
  './cards/S3.svg',
  './cards/S4.svg',
  './cards/S5.svg',
  './cards/S6.svg',
  './cards/S7.svg',
  './cards/S8.svg',
  './cards/S9.svg',
  './cards/S10.svg',
  './cards/S11.svg',
  './cards/S12.svg',
  './cards/S13.svg',
  './cards/H1.svg',
  './cards/H2.svg',
  './cards/H3.svg',
  './cards/H4.svg',
  './cards/H5.svg',
  './cards/H6.svg',
  './cards/H7.svg',
  './cards/H8.svg',
  './cards/H9.svg',
  './cards/H10.svg',
  './cards/H11.svg',
  './cards/H12.svg',
  './cards/H13.svg',
  './cards/C1.svg',
  './cards/C2.svg',
  './cards/C3.svg',
  './cards/C4.svg',
  './cards/C5.svg',
  './cards/C6.svg',
  './cards/C7.svg',
  './cards/C8.svg',
  './cards/C9.svg',
  './cards/C10.svg',
  './cards/C11.svg',
  './cards/C12.svg',
  './cards/C13.svg',
  './cards/D1.svg',
  './cards/D2.svg',
  './cards/D3.svg',
  './cards/D4.svg',
  './cards/D5.svg',
  './cards/D6.svg',
  './cards/D7.svg',
  './cards/D8.svg',
  './cards/D9.svg',
  './cards/D10.svg',
  './cards/D11.svg',
  './cards/D12.svg',
  './cards/D13.svg',
  './cards/BACK.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();

    // Force already-open PWA windows to reload under the new worker.
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(clients.map(client => {
      if ('navigate' in client) return client.navigate(client.url);
      return Promise.resolve();
    }));
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isCore =
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('/app.js') ||
    url.pathname.endsWith('/styles.css') ||
    url.pathname.endsWith('/index.html');

  if (isCore) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
