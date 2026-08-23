/**
 * A single entry in the append-only event log that drives live updates.
 * Clients stream events by cursor, so a dropped connection resumes exactly
 * where it left off instead of losing broadcasts.
 */
export interface StreamEvent {
  id: number
  type: string
  payload: unknown
  at: string
}

/**
 * The only surface SIREN uses to persist anything.
 *
 * Two implementations ship: an in-memory store (zero setup — what you get by
 * cloning and running) and Upstash Redis (used automatically when deployed).
 * Swapping storage is therefore an environment variable, not a code change.
 */
export interface StorageAdapter {
  readCollection<T>(name: string): Promise<T[]>
  writeCollection<T>(name: string, items: readonly T[]): Promise<void>

  /**
   * Reads a collection, applies `change` to it, and stores the result as one
   * indivisible step.
   *
   * Reading and then writing as two calls loses updates: two reports filed in
   * the same second both read the same list, both write their own version of
   * it, and one of them silently never happened — while its reporter was told
   * it was filed. Every mutation that depends on current state belongs here
   * rather than in a `readCollection`/`writeCollection` pair.
   *
   * `change` must be pure, because a contended store will call it again
   * against fresher state rather than overwrite what it found.
   */
  mutateCollection<T, R>(
    name: string,
    change: (items: T[]) => { next: T[]; result: R },
  ): Promise<R>

  appendEvent(type: string, payload: unknown): Promise<StreamEvent>
  readEventsSince(cursor: number): Promise<StreamEvent[]>
  latestEventId(): Promise<number>
}

/** Events retained in the log. Older entries are discarded to bound memory. */
export const EVENT_LOG_LIMIT = 500
