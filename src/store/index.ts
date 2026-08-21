import type { StorageAdapter } from './adapter'
import { memoryAdapter } from './memory'
import { createRedisAdapter } from './redis'

const hasUpstashCredentials =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) && Boolean(process.env.UPSTASH_REDIS_REST_TOKEN)

/**
 * The active storage backend.
 *
 * Redis when Upstash credentials are present (i.e. deployed), otherwise the
 * zero-configuration in-memory store. Nothing else in the codebase needs to
 * know which one is running.
 */
export const store: StorageAdapter = hasUpstashCredentials ? createRedisAdapter() : memoryAdapter

export const storageBackend = hasUpstashCredentials ? 'upstash-redis' : 'in-memory'

export type { StorageAdapter, StreamEvent } from './adapter'
