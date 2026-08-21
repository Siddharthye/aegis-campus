import { Redis } from '@upstash/redis'
import { EVENT_LOG_LIMIT, type StorageAdapter, type StreamEvent } from './adapter'

const KEY_PREFIX = 'aegis'
const collectionKey = (name: string) => `${KEY_PREFIX}:collection:${name}`
const EVENTS_KEY = `${KEY_PREFIX}:events`
const EVENT_COUNTER_KEY = `${KEY_PREFIX}:events:id`

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
