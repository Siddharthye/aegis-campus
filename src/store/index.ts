import type { StorageAdapter } from './adapter'
import { createBlobAdapter } from './blob'
import { memoryAdapter } from './memory'
import { createRedisAdapter } from './redis'

const hasUpstashCredentials =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) && Boolean(process.env.UPSTASH_REDIS_REST_TOKEN)

const hasBlobCredentials = Boolean(process.env.BLOB_READ_WRITE_TOKEN)

/**
 * The active storage backend, chosen by which credentials exist.
 *
 * Redis first when it is configured, because it is the better fit for an
 * append-only log. Otherwise Vercel Blob, which is what the deployment
 * actually runs on: serverless invocations share no memory, so without a
 * shared store a report filed by one instance is invisible to the next.
 * Failing both, the zero-configuration in-memory store — which is all a
 * fresh clone needs, and is why `git clone && npm run dev` just works.
 *
 * Nothing else in the codebase knows which one is running.
 */
export const store: StorageAdapter = hasUpstashCredentials
  ? createRedisAdapter()
  : hasBlobCredentials
    ? createBlobAdapter()
    : memoryAdapter

export const storageBackend = hasUpstashCredentials
  ? 'upstash-redis'
  : hasBlobCredentials
    ? 'vercel-blob'
    : 'in-memory'

export type { StorageAdapter, StreamEvent } from './adapter'
