const CACHE_NAME = 'relish-approvals-v46';
const DYNAMIC_CACHE = 'relish-approvals-dynamic-v16';
const urlsToCache = [
  '/styles.css?v=16',
  '/app.js?v=29',
  '/logo.png',
  '/manifest.json',
  '/android-launchericon-192-192.png',
  '/android-launchericon-512-512.png',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7.23.9/babel.min.js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  const cacheWhitelist = [CACHE_NAME, DYNAMIC_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const _url = new URL(event.request.url);

  // ── Web Share Target ────────────────────────────────────────────────────
  // Android calls POST /share-target (multipart/form-data) when the user
  // taps "Relish Approvals" in the share sheet.  We read the file here in
  // the service worker (the only place POST form-data is accessible), convert
  // it to base64, stash it in a named cache, then redirect the app to
  // /?incoming-share=1 so the React layer can retrieve and process it.
  if (event.request.method === 'POST' && _url.pathname === '/share-target') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('receipt');
        if (file instanceof File && file.size > 0) {
          const arrayBuffer = await file.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          // Chunked btoa — avoids stack overflow on large files (2MB+ PDFs)
          const chunkSize = 0x8000;
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i += chunkSize) {
            binary += String.fromCharCode.apply(
              null, bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength))
            );
          }
          const base64 = btoa(binary);
          const payload = JSON.stringify({
            mimeType: file.type || 'application/octet-stream',
            base64Data: base64,
            fileName: file.name || 'receipt'
          });
          const cache = await caches.open('relish-share-pending');
          await cache.put('/_share_pending', new Response(payload, {
            headers: { 'Content-Type': 'application/json' }
          }));
        }
      } catch (err) {
        console.warn('[SW] share-target processing failed:', err.message);
      }
      return Response.redirect('/?incoming-share=1', 303);
    })());
    return;
  }

  // ── Serve the stashed share payload back to the app ─────────────────────
  // The app fetches GET /_share_pending after being redirected from /share-target.
  // We serve it from the named cache and delete it immediately (consume-once).
  if (event.request.method === 'GET' && _url.pathname === '/_share_pending') {
    event.respondWith((async () => {
      const cache = await caches.open('relish-share-pending');
      const cached = await cache.match('/_share_pending');
      if (cached) {
        await cache.delete('/_share_pending');
        return cached;
      }
      return new Response(JSON.stringify({ error: 'no pending share' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    })());
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) return;

  // API calls: Network-first strategy (always fetch fresh data)
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and cache the fresh response for offline use
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed, try to serve from cache
          console.log('[Service Worker] Network failed, serving API from cache:', event.request.url);
          return caches.match(event.request);
        })
    );
    return;
  }

  // App code files & navigation: Network-first strategy (always serve latest code)
  const url = new URL(event.request.url);
  const isAppCode = url.pathname === '/app.js' || url.pathname === '/styles.css' || url.pathname === '/service-worker.js';
  const isNavigation = event.request.mode === 'navigate';
  if (isAppCode || isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          console.log('[Service Worker] Network failed, serving app code from cache:', event.request.url);
          return caches.match(event.request);
        })
    );
    return;
  }

  // Static assets: Cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          console.log('[Service Worker] Serving from cache:', event.request.url);
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          return response;
        }).catch((error) => {
          console.log('[Service Worker] Fetch failed:', error);
          
          // Return offline page for navigation requests
          if (event.request.mode === 'navigate') {
          }
          
          return new Response('Offline - Please check your internet connection', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  if (event.tag === 'sync-vouchers') {
    event.waitUntil(syncVouchers());
  }
});

async function syncVouchers() {
  console.log('[Service Worker] Syncing vouchers...');
  // Placeholder for background sync logic
  // Would sync pending actions when back online
}

// Push notifications with native device alerts
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Relish Approvals', body: event.data?.text() || 'New notification' };
  }
  
  const options = {
    body: data.body || 'New voucher awaiting approval',
    icon: data.icon || '/android-launchericon-192-192.png',
    badge: data.badge || '/android-launchericon-96-96.png',
    // Vibration pattern: vibrate 300ms, pause 100ms, vibrate 200ms, pause 100ms, vibrate 300ms
    vibrate: [300, 100, 200, 100, 300],
    // Sound is handled by the system based on notification settings
    sound: '/notification.mp3', // Optional: custom sound file
    data: {
      url: data.url || '/',
      timestamp: data.timestamp || Date.now()
    },
    actions: [
      { action: 'view', title: '👁️ View', icon: '/android-launchericon-96-96.png' },
      { action: 'dismiss', title: '✕ Dismiss' }
    ],
    // Keep notification visible until user interacts
    requireInteraction: true,
    // Unique tag - same tag replaces previous notification
    tag: 'relish-voucher-' + (data.timestamp || Date.now()),
    // Re-notify even if replacing a notification with same tag
    renotify: true,
    // Show notification silently (no sound/vibration) - set to false for alerts
    silent: false,
    // Timestamp for when the notification was created
    timestamp: data.timestamp || Date.now()
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Relish Approvals', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.action);
  event.notification.close();

  // Handle dismiss action - just close the notification
  if (event.action === 'dismiss') {
    return;
  }

  // Handle view action or notification body click
  if (event.action === 'view' || !event.action) {
    const urlToOpen = event.notification.data?.url || '/';
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Check if app is already open
          for (let client of clientList) {
            if (client.url.includes(self.registration.scope) && 'focus' in client) {
              client.postMessage({ type: 'NOTIFICATION_CLICK', url: urlToOpen });
              return client.focus();
            }
          }
          // Open new window if app is not open
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
    );
  }
});

// Handle notification close (swipe away or timeout)
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification closed:', event.notification.tag);
});
