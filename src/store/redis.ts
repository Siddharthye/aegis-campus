import { Redis } from '@upstash/redis'
import { EVENT_LOG_LIMIT, type StorageAdapter, type StreamEvent } from './adapter'

const KEY_PREFIX = 'aegis'
const collectionKey = (name: string) => `${KEY_PREFIX}:collection:${name}`
const EVENTS_KEY = `${KEY_PREFIX}:events`
const EVENT_COUNTER_KEY = `${KEY_PREFIX}:events:id`
/** Bumped on every mutation, so a stale read can be detected before it writes. */
const versionKey = (name: string) => `${KEY_PREFIX}:collection:${name}:version`

/** Attempts for a conditional write before giving up. */
const MAX_WRITE_ATTEMPTS = 4

/**
 * Writes `value` only if the version is still what the caller read, and bumps
 * it. Redis runs a script to completion without interleaving, which is what
 * makes the check and the write one step.
 */
const CAS_SCRIPT = `
if redis.call('GET', KEYS[2]) == ARGV[2] or (redis.call('EXISTS', KEYS[2]) == 0 and ARGV[2] == '') then
  redis.call('SET', KEYS[1], ARGV[1])
  redis.call('INCR', KEYS[2])
  return 1
end
return 0
`

/**
 * Upstash Redis storage, used automatically when `UPSTASH_REDIS_REST_URL` is set.
 *
 * Serverless functions do not share memory between invocations, so a deployed
 * instance needs a store that outlives a single request. Upstash speaks HTTP,
 * which means no connection pooling to manage.
 */
export function createRedisAdapter(): StorageAdapter {
  const redis = Redis.fromEnv()

  return {
    async readCollection<T>(name: string): Promise<T[]> {
      return (await redis.get<T[]>(collectionKey(name))) ?? []
    },

    async writeCollection<T>(name: string, items: readonly T[]): Promise<void> {
      await redis.set(collectionKey(name), items)
    },

    async mutateCollection<T, R>(
      name: string,
      change: (items: T[]) => { next: T[]; result: R },
    ): Promise<R> {
      for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
        const [items, version] = await Promise.all([
          redis.get<T[]>(collectionKey(name)),
          redis.get<number | string>(versionKey(name)),
        ])

        const { next, result } = change(items ?? [])
        const swapped = await redis.eval(
          CAS_SCRIPT,
          [collectionKey(name), versionKey(name)],
          [JSON.stringify(next), version === null ? '' : String(version)],
        )

        if (swapped === 1) return result
        // Another writer landed first, so this read is stale and the whole
        // change has to be recomputed against what is actually stored.
      }

      throw new Error(`Contended write to "${name}" gave up after ${MAX_WRITE_ATTEMPTS} attempts`)
    },

    async appendEvent(type: string, payload: unknown): Promise<StreamEvent> {
      const event: StreamEvent = {
        id: await redis.incr(EVENT_COUNTER_KEY),
        type,
        payload,
        at: new Date().toISOString(),
      }

      await redis.rpush(EVENTS_KEY, event)
      await redis.ltrim(EVENTS_KEY, -EVENT_LOG_LIMIT, -1)

      return event
    },

    async readEventsSince(cursor: number): Promise<StreamEvent[]> {
      const events = await redis.lrange<StreamEvent>(EVENTS_KEY, -EVENT_LOG_LIMIT, -1)
      return events.filter((event) => event.id > cursor)
    },

    async latestEventId(): Promise<number> {
      return (await redis.get<number>(EVENT_COUNTER_KEY)) ?? 0
    },
  }
}
