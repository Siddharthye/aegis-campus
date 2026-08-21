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
  appendEvent(type: string, payload: unknown): Promise<StreamEvent>
  readEventsSince(cursor: number): Promise<StreamEvent[]>
  latestEventId(): Promise<number>
}

/** Events retained in the log. Older entries are discarded to bound memory. */
export const EVENT_LOG_LIMIT = 500
