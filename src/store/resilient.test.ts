import { describe, expect, it, vi } from 'vitest'
import { StoreContentionError, type StorageAdapter } from './adapter'
import { withMemoryFallback } from './resilient'

/* Collection names nothing else owns, so the memory adapter's on-disk cache
   from a dev run cannot leak into these assertions. */
let nextName = 0
const collection = () => `resilient-test-${nextName++}`

/** A store that fails every call with `error`. */
const alwaysFailing = (error: Error): StorageAdapter => ({
  readCollection: vi.fn().mockRejectedValue(error),
  writeCollection: vi.fn().mockRejectedValue(error),
  mutateCollection: vi.fn().mockRejectedValue(error),
  appendEvent: vi.fn().mockRejectedValue(error),
  readEventsSince: vi.fn().mockRejectedValue(error),
  latestEventId: vi.fn().mockRejectedValue(error),
})

describe('withMemoryFallback', () => {
  it('serves from memory when the store cannot be reached', async () => {
    const store = withMemoryFallback(alwaysFailing(new Error('ECONNREFUSED')), 'test')
    await expect(store.readCollection(collection())).resolves.toEqual([])
  })

  it('stops calling a store it has given up on', async () => {
    const primary = alwaysFailing(new Error('suspended'))
    const store = withMemoryFallback(primary, 'test')

    await store.readCollection(collection())
    await store.readCollection(collection())

    expect(primary.readCollection).toHaveBeenCalledTimes(1)
  })

  it('does not treat a busy store as an unreachable one', async () => {
    // The whole point of separating the two. Degrading here would give this
    // instance a private copy of the data for the rest of its life, so every
    // report it went on to accept would be invisible to everyone else —
    // permanent, silent data loss triggered by nothing worse than two people
    // reporting the same fire at the same moment.
    // Only the contended write fails; a busy store still serves reads.
    const primary: StorageAdapter = {
      ...alwaysFailing(new Error('unused')),
      readCollection: vi.fn().mockResolvedValue([]),
      mutateCollection: vi.fn().mockRejectedValue(new StoreContentionError('incidents', 8)),
    }
    const store = withMemoryFallback(primary, 'test')

    await expect(
      store.mutateCollection(collection(), (items) => ({ next: items, result: null })),
    ).rejects.toThrow(StoreContentionError)

    // Still trusted: the next call goes to the real store, not straight to memory.
    await expect(store.readCollection(collection())).resolves.toEqual([])
    expect(primary.readCollection).toHaveBeenCalledTimes(1)
  })

  it('keeps writes readable once it has fallen back', async () => {
    const store = withMemoryFallback(alwaysFailing(new Error('outage')), 'test')
    const name = collection()

    await store.writeCollection(name, [{ id: 'resp-1' }])
    await expect(store.readCollection(name)).resolves.toEqual([{ id: 'resp-1' }])
  })
})
