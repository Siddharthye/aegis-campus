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

/* ── Background delivery of held reports ─────────────────────────────────
   The queue lives in IndexedDB precisely so this can reach it: localStorage
   is invisible to a service worker, and a report that only sends when
   someone reopens the tab is not really queued.

   These three constants and the record shape mirror `src/lib/queue-store.ts`.
   A service worker is a separate script and cannot import from the bundle,
   so the duplication is deliberate — change one, change the other. */
const DB_NAME = 'aegis'
const DB_VERSION = 1
const STORE = 'report-queue'
const SYNC_TAG = 'aegis-flush-reports'

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function readAll(db) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    request.onsuccess = () => resolve(request.result ?? [])
    request.onerror = () => reject(request.error)
  })
}

function remove(db, id) {
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).delete(id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => resolve()
  })
}

/**
 * Sends everything held, dropping each report that lands.
 *
 * A 400 is dropped too: a malformed report will never become valid, and
 * retrying it forever would keep the sync alive and the radio awake.
 * Anything else is left in place, and throwing tells the browser to try the
 * whole batch again later with its own backoff.
 */
async function flushQueue() {
  const db = await openDatabase()
  const held = await readAll(db)
  let failed = 0

  for (const report of held) {
    try {
      const response = await fetch(report.endpoint ?? '/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report.body),
      })
      if (response.ok || response.status === 400) await remove(db, report.id)
      else failed++
    } catch {
      failed++
    }
  }

  if (failed > 0) throw new Error(`${failed} report(s) still held`)
}

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(flushQueue())
})
