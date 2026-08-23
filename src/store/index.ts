import type { StorageAdapter } from './adapter'
import { createBlobAdapter } from './blob'
import { memoryAdapter } from './memory'
import { createPostgresAdapter } from './postgres'
import { createRedisAdapter } from './redis'
import { withMemoryFallback } from './resilient'

/* Vercel's Postgres integrations set several aliases for the same database;
   whichever one is present is the one to use. */
const postgresUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  null

const hasUpstashCredentials =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) && Boolean(process.env.UPSTASH_REDIS_REST_TOKEN)

const hasBlobCredentials = Boolean(process.env.BLOB_READ_WRITE_TOKEN)

/**
 * The active storage backend, chosen by which credentials exist.
 *
 * Postgres first, because it is the only one of these that settles a
 * contended write and numbers the event log itself rather than asking this
 * code to get both right. Then Redis, then Vercel Blob — object storage was
 * never meant to be a database, and it shows in every conditional write.
 * Failing all three, the zero-configuration in-memory store — which is all a
 * fresh clone needs, and is why `git clone && npm run dev` just works.
 *
 * Whichever is chosen, serverless invocations share no memory, so without one
 * of them a report filed by one instance is invisible to the next.
 *
 * Nothing else in the codebase knows which one is running.
 */
/* Both hosted backends are wrapped: a store that is suspended, rate-limited
   or simply down degrades to in-memory rather than turning every request
   into a 500. An incident board may be stale; it may not be absent. */
export const store: StorageAdapter = postgresUrl
  ? withMemoryFallback(createPostgresAdapter(postgresUrl), 'postgres')
  : hasUpstashCredentials
    ? withMemoryFallback(createRedisAdapter(), 'upstash-redis')
    : hasBlobCredentials
      ? withMemoryFallback(createBlobAdapter(), 'vercel-blob')
      : memoryAdapter

export const storageBackend = postgresUrl
  ? 'postgres'
  : hasUpstashCredentials
    ? 'upstash-redis'
    : hasBlobCredentials
      ? 'vercel-blob'
      : 'in-memory'

export type { StorageAdapter, StreamEvent } from './adapter'
