import { StoreContentionError, type StorageAdapter } from './adapter'
import { memoryAdapter } from './memory'

/**
 * Keeps the app serving when its shared store cannot be reached.
 *
 * A hosted store can go away for reasons that have nothing to do with this
 * code — a suspended store, a rotated token, an outage. Without this, every
 * one of those turns the whole console into a 500, which for an incident
 * board is a far worse failure than showing slightly stale data.
 *
 * On the first failure it falls back to the in-memory store permanently for
 * that instance. Permanently, rather than retrying, because a store that is
 * failing is usually failing for the whole life of the instance, and retrying
 * on every read would add its timeout to every request.
 *
 * Contention is pointedly excluded. A store that is busy is working, and
 * treating "two people reported at once" as an outage would cut this instance
 * off from everyone else's data for good — turning a moment of load into
 * permanent, invisible data loss. Those failures are passed through.
 *
 * The trade is explicit: reachable store means shared state across
 * invocations; unreachable means each instance keeps its own copy, exactly as
 * a fresh clone does. Degraded, not broken.
 */
export function withMemoryFallback(primary: StorageAdapter, label: string): StorageAdapter {
  let failed = false

  /** Runs against the primary store, falling back for good on first failure. */
  async function attempt<T>(
    viaPrimary: () => Promise<T>,
    viaMemory: () => Promise<T>,
  ): Promise<T> {
    if (failed) return viaMemory()

    try {
      return await viaPrimary()
    } catch (error) {
      if (error instanceof StoreContentionError) throw error

      failed = true
      console.error(
        `[store] ${label} unreachable, serving from memory for this instance:`,
        error instanceof Error ? error.message : error,
      )
      return viaMemory()
    }
  }

  return {
    readCollection: (name) =>
      attempt(
        () => primary.readCollection(name),
        () => memoryAdapter.readCollection(name),
      ),

    writeCollection: (name, items) =>
      attempt(
        () => primary.writeCollection(name, items),
        () => memoryAdapter.writeCollection(name, items),
      ),

    mutateCollection: (name, change) =>
      attempt(
        () => primary.mutateCollection(name, change),
        () => memoryAdapter.mutateCollection(name, change),
      ),

    appendEvent: (type, payload) =>
      attempt(
        () => primary.appendEvent(type, payload),
        () => memoryAdapter.appendEvent(type, payload),
      ),

    readEventsSince: (cursor) =>
      attempt(
        () => primary.readEventsSince(cursor),
        () => memoryAdapter.readEventsSince(cursor),
      ),

    latestEventId: () =>
      attempt(
        () => primary.latestEventId(),
        () => memoryAdapter.latestEventId(),
      ),
  }
}
