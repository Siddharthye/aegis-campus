import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreContentionError } from './adapter'

/**
 * The Neon driver is a tagged-template function. Each call here records the
 * statement it was given and returns the next queued result, which is enough
 * to assert what the adapter does without a database.
 */
const results: unknown[][] = []
const statements: string[] = []

const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
  statements.push(strings.join('?').replace(/\s+/g, ' ').trim())
  void values
  return Promise.resolve(results.shift() ?? [])
}

vi.mock('@neondatabase/serverless', () => ({ neon: () => sql }))

const { createPostgresAdapter } = await import('./postgres')

const adapter = () => createPostgresAdapter('postgres://test')
const said = (fragment: string) => statements.some((s) => s.includes(fragment))

beforeEach(() => {
  results.length = 0
  statements.length = 0
})

describe('postgres collections', () => {
  it('reads back what was stored', async () => {
    results.push([{ items: [{ id: 'inc-1' }], version: 4 }])
    await expect(adapter().readCollection('incidents')).resolves.toEqual([{ id: 'inc-1' }])
  })

  it('treats a collection that was never written as empty', async () => {
    results.push([])
    await expect(adapter().readCollection('incidents')).resolves.toEqual([])
  })

  it('inserts rather than updates when the collection does not exist yet', async () => {
    // Two instances racing to create the same collection must not have one
    // silently overwrite the other's row.
    results.push([], [{ name: 'incidents' }])

    await adapter().mutateCollection('incidents', (items) => ({
      next: [...items, { id: 'inc-1' }],
      result: 'done',
    }))

    expect(said('INSERT INTO aegis_collection')).toBe(true)
    expect(said('ON CONFLICT (name) DO NOTHING')).toBe(true)
  })

  it('only updates the version it actually read', async () => {
    results.push([{ items: [], version: 7 }], [{ name: 'incidents' }])

    await adapter().mutateCollection('incidents', (items) => ({ next: items, result: null }))

    expect(said('WHERE name = ? AND version = ?')).toBe(true)
  })

  it('recomputes against fresh state when another write lands first', async () => {
    // The lost-update case: the first attempt's version is stale, so the
    // update matches nothing and the change has to be rebuilt from what is
    // actually stored.
    results.push(
      [{ items: [{ id: 'inc-a' }], version: 1 }],
      [], // conditional update matched no row
      [{ items: [{ id: 'inc-a' }, { id: 'inc-b' }], version: 2 }],
      [{ name: 'incidents' }],
    )

    const count = await adapter().mutateCollection<{ id: string }, number>(
      'incidents',
      (items) => ({ next: [...items, { id: 'inc-c' }], result: items.length + 1 }),
    )

    expect(count).toBe(3)
  })

  it('reports contention as contention, not as a broken store', async () => {
    // A busy database is working. The wrapper above this must not mistake it
    // for an outage and cut the instance over to a private in-memory copy.
    for (let attempt = 0; attempt < 8; attempt++) results.push([{ items: [], version: 1 }], [])

    await expect(
      adapter().mutateCollection('incidents', (items) => ({ next: items, result: null })),
    ).rejects.toThrow(StoreContentionError)
  })
})

describe('postgres event log', () => {
  it('lets the sequence number events instead of counting them here', async () => {
    results.push([{ id: 12, type: 'incident.created', payload: {}, at: '2026-08-23T06:00:00.000Z' }], [])

    const event = await adapter().appendEvent('incident.created', { id: 'inc-1' })

    expect(event.id).toBe(12)
    expect(said('INSERT INTO aegis_event')).toBe(true)
    expect(said('RETURNING id, type, payload')).toBe(true)
  })

  it('trims the log so it cannot grow without bound', async () => {
    results.push([{ id: 1, type: 't', payload: {}, at: 'now' }], [])
    await adapter().appendEvent('t', {})
    expect(said('DELETE FROM aegis_event')).toBe(true)
  })

  it('resumes from a cursor, in order', async () => {
    results.push([{ id: 5, type: 't', payload: {}, at: 'now' }])
    await adapter().readEventsSince(4)
    expect(said('WHERE id > ? ORDER BY id')).toBe(true)
  })

  it('reports an empty log as cursor zero', async () => {
    results.push([{ id: 0 }])
    await expect(adapter().latestEventId()).resolves.toBe(0)
  })
})
