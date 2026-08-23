import { neon } from '@neondatabase/serverless'
import {
  EVENT_LOG_LIMIT,
  StoreContentionError,
  type StorageAdapter,
  type StreamEvent,
} from './adapter'

/**
 * Postgres storage — the shared state a deployed AEGIS runs on.
 *
 * Serverless invocations share no memory, so without a shared store a report
 * filed by one instance is invisible to the next. Postgres gives that, and
 * gives it with real guarantees: the event log is a sequence rather than a
 * number this code has to keep correct, and a contended write is decided by
 * the database instead of by a retry loop hoping to win a race.
 *
 * Neon speaks HTTP, so each statement is a single request with no connection
 * to pool or tear down between invocations. That rules out holding a
 * transaction open across a caller's callback, which is why `mutateCollection`
 * uses a version column rather than `SELECT … FOR UPDATE`: the update only
 * applies if the row still looks the way it did when it was read.
 */

/** Attempts for a conditional write before giving up. */
const MAX_WRITE_ATTEMPTS = 8

/** Spreads collided writers apart so the retry does not just collide again. */
function backOff(attempt: number): Promise<void> {
  const ceiling = 25 * 2 ** attempt
  return new Promise((resolve) => setTimeout(resolve, Math.random() * ceiling))
}

export function createPostgresAdapter(connectionString: string): StorageAdapter {
  const sql = neon(connectionString)

  /** Rows exist for every collection ever written; absent means empty. */
  async function readRow<T>(name: string): Promise<{ items: T[]; version: number }> {
    const rows = (await sql`
      SELECT items, version FROM aegis_collection WHERE name = ${name}
    `) as { items: T[]; version: number }[]

    return rows[0] ?? { items: [], version: 0 }
  }

  return {
    async readCollection<T>(name: string): Promise<T[]> {
      return (await readRow<T>(name)).items
    },

    async writeCollection<T>(name: string, items: readonly T[]): Promise<void> {
      // Stores exactly this list, last write wins — the caller has already
      // decided what the collection should contain.
      await sql`
        INSERT INTO aegis_collection (name, items, version)
        VALUES (${name}, ${JSON.stringify(items)}::jsonb, 1)
        ON CONFLICT (name)
        DO UPDATE SET items = EXCLUDED.items, version = aegis_collection.version + 1
      `
    },

    async mutateCollection<T, R>(
      name: string,
      change: (items: T[]) => { next: T[]; result: R },
    ): Promise<R> {
      for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
        const { items, version } = await readRow<T>(name)
        const { next, result } = change(items)
        const payload = JSON.stringify(next)

        // Version 0 means the row does not exist yet. Inserting rather than
        // updating is what makes two instances racing to create the same
        // collection safe: the second one loses the conflict and retries
        // against what the first actually wrote.
        const applied =
          version === 0
            ? await sql`
                INSERT INTO aegis_collection (name, items, version)
                VALUES (${name}, ${payload}::jsonb, 1)
                ON CONFLICT (name) DO NOTHING
                RETURNING name
              `
            : await sql`
                UPDATE aegis_collection
                SET items = ${payload}::jsonb, version = version + 1
                WHERE name = ${name} AND version = ${version}
                RETURNING name
              `

        if ((applied as unknown[]).length > 0) return result
        await backOff(attempt)
      }

      throw new StoreContentionError(name, MAX_WRITE_ATTEMPTS)
    },

    async appendEvent(type: string, payload: unknown): Promise<StreamEvent> {
      // Ids come from a sequence, so they stay monotonic under any amount of
      // concurrency without this code counting anything.
      const rows = (await sql`
        INSERT INTO aegis_event (type, payload)
        VALUES (${type}, ${JSON.stringify(payload)}::jsonb)
        RETURNING id, type, payload, to_char(at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at
      `) as StreamEvent[]

      // Trimming here rather than on a schedule: there is no scheduler, and
      // the log only grows when something is appended to it.
      await sql`
        DELETE FROM aegis_event
        WHERE id <= (SELECT MAX(id) - ${EVENT_LOG_LIMIT} FROM aegis_event)
      `

      return rows[0]
    },

    async readEventsSince(cursor: number): Promise<StreamEvent[]> {
      return (await sql`
        SELECT id, type, payload,
               to_char(at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at
        FROM aegis_event
        WHERE id > ${cursor}
        ORDER BY id
      `) as StreamEvent[]
    },

    async latestEventId(): Promise<number> {
      const rows = (await sql`SELECT COALESCE(MAX(id), 0) AS id FROM aegis_event`) as {
        id: number
      }[]
      return Number(rows[0]?.id ?? 0)
    },
  }
}
