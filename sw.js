const CACHE_NAME = 'trial-dynamic-v21';
const BASE = '/hospital-form/';  // Match your GitHub Pages repo name

// Files that MUST be available offline immediately
const PRE_CACHE_ASSETS = [
    BASE + 'index.html',
    BASE + 'manifest.json',
    BASE + 'icon.png',
   
];

// Install: Cache essential files with error handling
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            try {
                // Try to cache each asset individually
                for (const asset of PRE_CACHE_ASSETS) {
                    try {
                        const response = await fetch(asset);
                        if (response.ok) {
                            await cache.put(asset, response);
                        }
                    } catch (err) {
                        console.log('Failed to cache:', asset, err);
                    }
                }
            } catch (err) {
                console.log('Cache error:', err);
            }
        })
    );
    self.skipWaiting();
});

// Activate: Clean up old cache versions
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => {
                if (key !== CACHE_NAME) return caches.delete(key);
            })
        ))
    );
    self.clients.claim();
});

// Fetch: Cache First, then Network
self.addEventListener('fetch', e => {
    // Skip non-GET requests
    if (e.request.method !== 'GET') return;
    
    // Skip cross-origin requests for better reliability
    if (!e.request.url.startsWith(self.location.origin)) return;

    e.respondWith(
        caches.match(e.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(e.request).then(networkResponse => {
                // Only cache successful responses
                if (networkResponse && networkResponse.status === 200) {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(e.request, networkResponse.clone());
                        return networkResponse;
                    });
                }
                return networkResponse;
            });
        }).catch(() => {
            // If offline and not in cache, return fallback for navigation
            if (e.request.mode === 'navigate') {
                return caches.match(BASE + 'index.html');
            }
            return new Response('Offline content not available', {
                status: 404,
                statusText: 'Not Found'
            });
        })
    );
});
