/**
 * BizBrain — sw.js
 * Service Worker: offline caching, background sync, push notifications.
 */

const CACHE_NAME     = 'bizbrain-v8';
const DYNAMIC_CACHE  = 'bizbrain-dynamic-v8';
const API_CACHE      = 'bizbrain-api-v8';

// ── Static assets to pre-cache on install ─────────────────────
const BASE_PATH = self.location.pathname.replace('/sw.js', '') || '';

const PRECACHE_URLS = [
  BASE_PATH + '/index.html',
  BASE_PATH + '/css/app.css',
  BASE_PATH + '/css/dashboard.css',
  BASE_PATH + '/css/forms.css',
  BASE_PATH + '/css/registration.css',
  BASE_PATH + '/css/tables.css',
  BASE_PATH + '/js/app.js',
  BASE_PATH + '/js/router.js',
  BASE_PATH + '/js/sync.js',
  BASE_PATH + '/js/auth.js',
  BASE_PATH + '/js/db.js',
  BASE_PATH + '/js/api.js',
  BASE_PATH + '/js/registration.js',
  BASE_PATH + '/pages/dashboard.html',
  BASE_PATH + '/pages/suppliers.html',
  BASE_PATH + '/pages/customers.html',
  BASE_PATH + '/pages/products.html',
  BASE_PATH + '/pages/categories.html',
  BASE_PATH + '/pages/expenses.html',
  BASE_PATH + '/pages/reports.html',
  BASE_PATH + '/pages/settings.html',
  BASE_PATH + '/pages/accounts.html',
  BASE_PATH + '/pages/team.html',
  BASE_PATH + '/pages/purchase_invoices.html',
  BASE_PATH + '/pages/sales_invoices.html',
  BASE_PATH + '/pages/purchase_returns.html',
  BASE_PATH + '/pages/sales_returns.html',
  BASE_PATH + '/pages/registration.html',
  BASE_PATH + '/manifest.json',
  BASE_PATH + '/pages/errors/404.html',
  BASE_PATH + '/pages/errors/401.html',
  BASE_PATH + '/pages/errors/403.html',
  BASE_PATH + '/pages/errors/500.html',
  BASE_PATH + '/pages/errors/offline.html',
  BASE_PATH + '/pages/errors/supplier-not-found.html',
  BASE_PATH + '/pages/errors/customer-not-found.html',
  BASE_PATH + '/pages/errors/product-not-found.html',
  BASE_PATH + '/pages/errors/invoice-not-found.html',
  BASE_PATH + '/pages/errors/maintenance.html',
  BASE_PATH + '/pages/errors/session-expired.html',
  BASE_PATH + '/pages/errors/no-data.html',
];

// ── Install: pre-cache static shell ───────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing…');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Pre-cache failed:', err))
  );
});

// ── Activate: clean up old caches ────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating…');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => ![CACHE_NAME, DYNAMIC_CACHE, API_CACHE].includes(k))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: route requests through cache strategy ──────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET for dynamic caching (POST/PUT/DELETE go straight to network)
  if (request.method !== 'GET') return;

  // Skip browser-extension and chrome-extension requests
  if (!url.protocol.startsWith('http')) return;

  // ── PHP API calls — Network only, never cache 401s ──────
  if (url.pathname.includes('/php/')) {
    event.respondWith(networkOnly(request));
    return;
  }

  // ── Google Fonts, CDN — Cache first ──────────────────────
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'    ||
    url.hostname === 'cdnjs.cloudflare.com'
  ) {
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
    return;
  }

  // ── Navigation requests (SPA routes) — Serve index.html ──
  // All paths like /products, /suppliers/SUP-001 get index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try network first for navigation
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
            return networkResponse;
          }
          throw new Error('Network response not ok');
        } catch (_) {
          // Fallback to cached index.html (with base path)
          const indexUrl = BASE_PATH + '/index.html';
          const cachedIndex = await caches.match(indexUrl);
          if (cachedIndex) return cachedIndex;
          // Fallback to cached root
          const cachedRoot = await caches.match(BASE_PATH + '/');
          if (cachedRoot) return cachedRoot;
          return new Response('Offline', { status: 503 });
        }
      })()
    );
    return;
  }

  // ── App shell & pages — Cache first, network fallback ────
  event.respondWith(cacheFirst(request, CACHE_NAME));
});

// ── Background Sync ───────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'bizbrain-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Notify the main thread to run sync
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'BACKGROUND_SYNC' });
  });
}

// ── Push Notifications ────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const opts = {
    body:    data.body    || 'You have a new notification',
    icon:    data.icon    || '/assets/icon-192.png',
    badge:   data.badge   || '/assets/icon-72.png',
    tag:     data.tag     || 'bizbrain',
    data:    data.url     || '/',
    actions: data.actions || [],
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'BizBrain', opts)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow(event.notification.data || '/')
  );
});

// ── Cache Strategies ──────────────────────────────────────────

/**
 * Cache First: serve from cache, fall back to network and update cache.
 */
async function cacheFirst(request, cacheName) {
  const cache    = await caches.open(cacheName);
  const cached   = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== 'opaque') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    // Return offline fallback page if available
    const fallback = await caches.match(BASE_PATH + '/index.html');
    return fallback || new Response('Offline', { status: 503 });
  }
}

/**
 * Network Only: no caching, throws if offline.
 */
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (_) {
    return new Response(
      JSON.stringify({ success: false, message: 'Offline — request not available', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Stale-While-Revalidate: serve cache immediately, update in background.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then(response => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || networkFetch;
}

// ── Message handler (from main thread) ───────────────────────
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'CACHE_UPDATE') {
    // Re-cache specific URLs
    const urls = event.data.urls || [];
    caches.open(CACHE_NAME).then(cache => cache.addAll(urls));
  }
});
