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
const CACHE = 'aegis-shell-v1'
const PRECACHE = ['/report', '/case', '/manifest.webmanifest', '/icon.svg']

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

  // Emergency data must never be served stale.
  if (url.pathname.startsWith('/api/')) return

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
