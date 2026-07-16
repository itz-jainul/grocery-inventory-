// ===== GroceryVault Service Worker =====
const CACHE_NAME = 'groceryvault-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// External CDN resources to cache
const CDN_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.0/firebase-storage-compat.js',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];

// ===== Install Event: Cache static assets =====
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      // Cache local assets first (these should always work)
      return cache.addAll(STATIC_ASSETS).then(() => {
        // Try to cache CDN assets (may fail offline, that's OK)
        return Promise.allSettled(
          CDN_ASSETS.map(url => cache.add(url).catch(err => {
            console.warn('[SW] Failed to cache CDN asset:', url, err);
          }))
        );
      });
    })
  );
  // Activate immediately without waiting for old SW to finish
  self.skipWaiting();
});

// ===== Activate Event: Clean up old caches =====
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// ===== Fetch Event: Network-first for API, Cache-first for assets =====
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Firebase/Firestore API calls (let them go to network always)
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com') && url.pathname.includes('/firestore/')) {
    return;
  }

  // For everything else: Stale-While-Revalidate strategy
  // Serve from cache immediately, then update cache in background
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          // Only cache successful responses
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Network failed, return nothing (cached version already served)
          return null;
        });

        // Return cached version immediately, or wait for network
        return cachedResponse || fetchPromise;
      });
    })
  );
});

// ===== Background Sync (for future offline support) =====
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-products') {
    console.log('[SW] Background sync triggered');
    // Future: sync offline changes to Firestore
  }
});

// ===== Push Notifications (for future low-stock alerts) =====
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'You have a new notification',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/' }
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'GroceryVault', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
