/**
 * AEGIS service worker — keeps the report screen usable with no network.
 *
 * Strategy is deliberately split by what the response means:
 *
 *   - Navigations and static assets: network first, cache as a fallback. The
 *     app shell is small, and a stale shell is far better than a dead tab in a
 *     stairwell with no signal.
 *   - API calls: never cached. A cached incident list would show a dispatcher
 *     a stale emergency board, which is worse than showing them an error.
 *
 * Unsent reports are not handled here — they live in localStorage via
 * `use-offline-queue.ts`, so they survive the tab closing entirely, which a
 * service worker fetch retry would not.
 */
const CACHE = 'aegis-shell-v2'

/* The screens someone opens when they are in trouble. Safe Walk is here
   because a dead zone and needing to know which way to walk are the same
   situation: alone, outdoors, after dark, at the edge of campus. */
const PRECACHE = [
  '/report',
  '/safe-walk',
  '/case',
  '/manifest.webmanifest',
  '/icon.svg',
]

/* Advisory data that is worth having stale.
   Risk patterns are computed over sixty days and banded into three-hour
   windows, so yesterday's copy gives the same answer as today's — and a
   walker deciding which way to go in the dark is far better served by an
   old answer than by none. Everything else under /api stays uncached:
   a stale incident board would show a dispatcher an emergency that is
   already handled, or hide one that is not. */
const CACHEABLE_API = ['/api/risk']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // A failed precache must not block activation; pages still work online.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/api/')) {
    // Advisory endpoints answer from the network when there is one and from
    // the last good copy when there is not. Everything else is left alone,
    // so a dispatcher can never be shown a stale board.
    if (!CACHEABLE_API.some((path) => url.pathname.startsWith(path))) return

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            void caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) return cached
          // Never seen online, so there is nothing honest to serve.
          return Response.error()
        }),
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        // An uncached page offline still beats a browser error page.
        return (await caches.match('/report')) ?? Response.error()
      }),
  )
})
