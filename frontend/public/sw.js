/**
 * AKADEMI Digital Campus — Service Worker
 *
 * Cache strategies:
 * - Static assets (JS/CSS/fonts): Cache-first (fast, versioned by filename hash)
 * - API calls: Network-first with offline fallback (always try fresh data)
 * - Pages: Stale-while-revalidate (show cached, update in background)
 * - Restricted data (grades, finance, canvas layers): Never cached
 */

const CACHE_VERSION = 'akademi-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`
const PAGE_CACHE = `${CACHE_VERSION}-pages`

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// Paths that must NEVER be cached (restricted data)
const NEVER_CACHE_PATTERNS = [
  /\/api\/v1\/grades/,
  /\/api\/v1\/finance/,
  /\/api\/v1\/payments/,
  /\/api\/v1\/canvas-documents/,
  /\/api\/v1\/essay-responses/,
  /\/api\/v1\/attempts/,
  /\/api\/v1\/audit-events/,
  /\/api\/v1\/safeguarding/,
  /\/api\/v1\/consent/,
  /\/api\/v1\/parent-child-links/,
]

// Paths that should use network-first (API data)
const API_PATTERNS = [
  /\/api\/v1\//,
]

// ─── INSTALL ────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('SW: Pre-cache partial failure:', err)
        // Don't fail install if some URLs are missing
      })
    })
  )
  self.skipWaiting()
})

// ─── ACTIVATE ───────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('akademi-') && name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== PAGE_CACHE)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// ─── FETCH ──────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip chrome-extension and other non-http
  if (!url.protocol.startsWith('http')) return

  // Never cache restricted data
  if (NEVER_CACHE_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(fetch(request))
    return
  }

  // API calls: Network-first with offline fallback
  if (API_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(networkFirst(request))
    return
  }

  // Static assets (hashed filenames): Cache-first
  if (/\.(js|css|woff2?|png|jpg|svg|ico)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // HTML pages: Stale-while-revalidate
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(staleWhileRevalidate(request, PAGE_CACHE))
    return
  }

  // Default: Network-first
  event.respondWith(networkFirst(request))
})

// ─── CACHE STRATEGIES ──────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response(
      JSON.stringify({ detail: 'Offline — please check your connection' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request)

  const fetchPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(cacheName)
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => cached)

  return cached || fetchPromise
}

// ─── MESSAGE HANDLER ────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name))
    })
  }
})
