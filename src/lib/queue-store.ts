'use client'

import { parseQueue, type QueuedReport } from '@/domain/offline-queue'

/**
 * Where unsent reports live on the device.
 *
 * IndexedDB rather than localStorage, for one reason: a service worker cannot
 * read localStorage. Moving the queue here is what lets the browser deliver a
 * held report through Background Sync after the tab is gone — which is the
 * difference between a report that waits for someone to reopen the app and
 * one that sends itself while the phone is in a pocket.
 *
 * The same three constants are duplicated in `public/sw.js`, because a
 * service worker is a separate script that cannot import from the bundle.
 * They are named here so the pair is obvious if either side changes.
 */

export const DB_NAME = 'aegis'
export const DB_VERSION = 1
export const STORE = 'report-queue'

/** Where the queue used to live. Read once, then cleared. */
const LEGACY_KEY = 'aegis.report-queue'

function openDatabase(): Promise<IDBDatabase> {
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

function transact<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }),
  )
}

/**
 * Every held report, oldest first.
 *
 * Anything still in localStorage from a previous version is moved across on
 * the first read, so upgrading the app cannot quietly discard an emergency
 * somebody is already holding.
 */
export async function readQueue(): Promise<QueuedReport[]> {
  try {
    await migrateLegacyQueue()
    const rows = await transact<QueuedReport[]>('readonly', (store) => store.getAll())
    return rows.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
  } catch {
    // A blocked or unavailable IndexedDB must not stop someone reporting;
    // the caller falls back to an in-memory queue for this session.
    return []
  }
}

export async function writeQueue(reports: readonly QueuedReport[]): Promise<void> {
  try {
    const db = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite')
      const store = transaction.objectStore(STORE)
      store.clear()
      for (const report of reports) store.put(report)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } catch {
    // Same as above: durability is lost, the report is not.
  }
}

/** Moves anything left in localStorage into IndexedDB, once. */
async function migrateLegacyQueue(): Promise<void> {
  const raw = window.localStorage.getItem(LEGACY_KEY)
  if (!raw) return

  const legacy = parseQueue(raw)
  if (legacy.length > 0) {
    const db = await openDatabase()
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(STORE, 'readwrite')
      const store = transaction.objectStore(STORE)
      for (const report of legacy) store.put(report)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => resolve()
    })
  }

  window.localStorage.removeItem(LEGACY_KEY)
}

/** The tag the service worker listens for. Shared with `public/sw.js`. */
export const SYNC_TAG = 'aegis-flush-reports'

/**
 * Asks the browser to deliver the queue when it next has a network, even if
 * this tab is closed by then.
 *
 * Background Sync is Chromium-only, so this is an enhancement rather than the
 * mechanism: the hook's own `online` listener and interval still run
 * everywhere, and iOS simply keeps using those.
 */
export async function requestBackgroundFlush(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready
    // `sync` is absent on browsers that do not implement it.
    const sync = (registration as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> }
    }).sync
    await sync?.register(SYNC_TAG)
  } catch {
    // No service worker, or sync refused. The in-page retry still covers it.
  }
}
