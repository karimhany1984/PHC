// ═══════════════════════════════════════════════════
//  Service Worker — Offline Cache + Share Target
// ═══════════════════════════════════════════════════

const CACHE_NAME = 'hospital-inspector-v3';

// All files that must be cached for offline use
const PRECACHE_URLS = [
  './',
  './index.html',
    './Icon.png',
  './manifest.json'
];

// ── Install: pre-cache the app shell ───────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ──────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: serve from cache, fall back to network ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ── Share Target: POST from WhatsApp / system share sheet ──
  if (url.pathname.endsWith('/share-target') && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request));
    return;
  }

  // ── Normal offline-first fetch ──
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful GET responses dynamically
        if (
          event.request.method === 'GET' &&
          response.ok &&
          !url.pathname.includes('chrome-extension')
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── Share Target handler ────────────────────────────
async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (file && file instanceof File) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = bufferToBase64(arrayBuffer);

      // Store the shared file temporarily in the cache as a special key
      const sharedPayload = JSON.stringify({
        name: file.name,
        type: file.type,
        data: base64,
        timestamp: Date.now()
      });

      const cache = await caches.open(CACHE_NAME);
      await cache.put(
        new Request('./shared-file'),
        new Response(sharedPayload, { headers: { 'Content-Type': 'application/json' } })
      );

      // Notify any open clients about the shared file
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.postMessage({
          type: 'SHARED_FILE',
          name: file.name,
          fileType: file.type,
          data: base64
        });
      }
    }
  } catch (err) {
    console.error('[SW] Share target error:', err);
  }

  // Always redirect back to the app after handling
  return Response.redirect('./', 303);
}

// ── Utility: ArrayBuffer → base64 ──────────────────
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
