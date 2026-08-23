import { BlobNotFoundError, get, put } from '@vercel/blob'
import {
  EVENT_LOG_LIMIT,
  StoreContentionError,
  type StorageAdapter,
  type StreamEvent,
} from './adapter'

/**
 * Vercel Blob storage — the shared state a deployed AEGIS runs on.
 *
 * Serverless functions do not share memory: a report filed by one invocation
 * is invisible to the next, which made the deployed demo look like it was
 * losing incidents. This gives every instance one place to read and write.
 *
 * Blob is object storage, not a database, so two things need care.
 *
 * Reads must skip the CDN (`useCache: false`). A cached read would hand a
 * dispatcher a stale queue, which is the one thing an incident board may not
 * do.
 *
 * Concurrency is handled differently for the two kinds of write, matching
 * what the in-memory and Redis adapters already promise:
 *
 * `writeCollection` stores exactly the list it is given, last write wins. The
 * caller has already computed that list, so a compare-and-swap here would add
 * nothing except a failure whenever two requests overlap.
 *
 * `appendEvent` is the one place a lost write would matter, because a dropped
 * event is an update a dispatcher never sees. It reads, appends and writes
 * conditionally on the ETag it read, retrying from fresh state if another
 * append landed first.
 */

/** One object per collection, plus one for the event log. */
const prefix = (name: string) => `aegis/${name}.json`

const EVENTS_PATHNAME = prefix('events')

/** Attempts for a conditional write before giving up. */
const MAX_WRITE_ATTEMPTS = 8

/**
 * Waits a growing, randomised moment before retrying a lost race.
 *
 * Retrying immediately makes contention worse: the writers that just collided
 * collide again, in step. Spreading them out is what lets a burst of reports
 * — the thing this system is built for — all land.
 */
function backOff(attempt: number): Promise<void> {
  const ceiling = 25 * 2 ** attempt
  return new Promise((resolve) => setTimeout(resolve, Math.random() * ceiling))
}

interface Snapshot<T> {
  items: T[]
  /** The ETag the items were read at, or null when nothing exists yet. */
  etag: string | null
}

/**
 * Reads a JSON object, treating "never written" as empty rather than an error.
 *
 * The distinction between *absent* and *unreadable* is load-bearing here.
 * Callers seed an empty collection with demo fixtures, so a read that answered
 * "empty" after a rate limit or an outage would overwrite a live incident
 * board with sample data. Only `BlobNotFoundError` means absent; anything else
 * that does not yield a readable body throws, which degrades the instance to
 * memory and leaves the stored data untouched. Stale beats destroyed.
 */
async function readSnapshot<T>(pathname: string): Promise<Snapshot<T>> {
  try {
    const result = await get(pathname, { access: 'private', useCache: false })
    if (!result || result.statusCode !== 200) {
      throw new Error(`Blob read failed for ${pathname}: ${result?.statusCode ?? 'no response'}`)
    }

    const text = await new Response(result.stream).text()
    return { items: JSON.parse(text) as T[], etag: result.blob.etag }
  } catch (error) {
    // The one signal that genuinely means "nothing has been written yet".
    if (error instanceof BlobNotFoundError) return { items: [], etag: null }
    throw error
  }
}

/** Writes JSON. With `etag`, the write fails if the object changed since. */
async function writeSnapshot<T>(pathname: string, items: readonly T[], etag?: string | null) {
  await put(pathname, JSON.stringify(items), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    // The object is the record; a cached copy of it is a stale queue.
    cacheControlMaxAge: 0,
    ...(etag ? { ifMatch: etag } : {}),
  })
}

/**
 * Applies `change` to the stored list and saves it, retrying from fresh state
 * if someone else wrote first. Used where losing a write would lose data.
 */
async function mutate<T, R>(
  pathname: string,
  change: (items: T[]) => { next: T[]; result: R },
): Promise<R> {
  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
    const { items, etag } = await readSnapshot<T>(pathname)
    const { next, result } = change(items)

    try {
      await writeSnapshot(pathname, next, etag)
      return result
    } catch {
      // A precondition failure means a concurrent write landed first, so the
      // read is stale and the whole change has to be recomputed against it.
      await backOff(attempt)
    }
  }

  throw new StoreContentionError(pathname, MAX_WRITE_ATTEMPTS)
}

export function createBlobAdapter(): StorageAdapter {
  return {
    async readCollection<T>(name: string): Promise<T[]> {
      return (await readSnapshot<T>(prefix(name))).items
    },

    async writeCollection<T>(name: string, items: readonly T[]): Promise<void> {
      await writeSnapshot(prefix(name), items)
    },

    async mutateCollection<T, R>(
      name: string,
      change: (items: T[]) => { next: T[]; result: R },
    ): Promise<R> {
      return mutate<T, R>(prefix(name), change)
    },

    async appendEvent(type: string, payload: unknown): Promise<StreamEvent> {
      return mutate<StreamEvent, StreamEvent>(EVENTS_PATHNAME, (events) => {
        const event: StreamEvent = {
          // Ids come from the log itself, so they stay monotonic without a
          // counter that could drift from the events it numbers.
          id: (events[events.length - 1]?.id ?? 0) + 1,
          type,
          payload,
          at: new Date().toISOString(),
        }
        return { next: [...events, event].slice(-EVENT_LOG_LIMIT), result: event }
      })
    },

    async readEventsSince(cursor: number): Promise<StreamEvent[]> {
      const { items } = await readSnapshot<StreamEvent>(EVENTS_PATHNAME)
      return items.filter((event) => event.id > cursor)
    },

    async latestEventId(): Promise<number> {
      const { items } = await readSnapshot<StreamEvent>(EVENTS_PATHNAME)
      return items[items.length - 1]?.id ?? 0
    },
  }
}
