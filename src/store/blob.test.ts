import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreContentionError } from './adapter'

const get = vi.fn()
const put = vi.fn()

class BlobNotFoundError extends Error {}

vi.mock('@vercel/blob', () => ({ get, put, BlobNotFoundError }))

const { createBlobAdapter } = await import('./blob')

/** A successful read of `items`, shaped the way the Blob client returns one. */
const found = (items: unknown[]) => ({
  statusCode: 200,
  stream: new Response(JSON.stringify(items)).body,
  blob: { etag: 'etag-1' },
})

beforeEach(() => {
  get.mockReset()
  put.mockReset()
})

describe('blob adapter reads', () => {
  it('reads back what was stored', async () => {
    get.mockResolvedValue(found([{ id: 'inc-1' }]))
    await expect(createBlobAdapter().readCollection('incidents')).resolves.toEqual([{ id: 'inc-1' }])
  })

  it('treats a collection that was never written as empty', async () => {
    get.mockRejectedValue(new BlobNotFoundError('no such blob'))
    await expect(createBlobAdapter().readCollection('incidents')).resolves.toEqual([])
  })

  it('fails loudly when the store errors instead of reporting it empty', async () => {
    // The whole point. Callers seed an empty collection with demo fixtures, so
    // a rate-limited or erroring read that answered "empty" would overwrite a
    // live incident board. Throwing degrades the instance to memory instead,
    // and the real data survives untouched.
    for (const statusCode of [304, 429, 500, 503]) {
      get.mockResolvedValue({ statusCode })
      await expect(createBlobAdapter().readCollection('incidents')).rejects.toThrow(
        String(statusCode),
      )
    }

    get.mockResolvedValue(null)
    await expect(createBlobAdapter().readCollection('incidents')).rejects.toThrow('no response')

    expect(put).not.toHaveBeenCalled()
  })

  it('fails loudly when the stored object is not readable JSON', async () => {
    get.mockResolvedValue({
      statusCode: 200,
      stream: new Response('{ truncated').body,
      blob: { etag: 'etag-1' },
    })
    await expect(createBlobAdapter().readCollection('incidents')).rejects.toThrow()
  })
})

describe('blob adapter concurrent writes', () => {
  it('recomputes against fresh state when another write lands first', async () => {
    // The lost-update case: two reports filed in the same second. Without a
    // conditional write the second one reads the list before the first was
    // stored, and overwrites it — the reporter is told "filed" and the report
    // does not exist. The retry has to rebuild from what is actually there.
    get
      .mockResolvedValueOnce(found([{ id: 'inc-a' }]))
      .mockResolvedValueOnce(found([{ id: 'inc-a' }, { id: 'inc-b' }]))
    put.mockRejectedValueOnce(new Error('Precondition failed: ETag mismatch')).mockResolvedValue({})

    const appended = await createBlobAdapter().mutateCollection<{ id: string }, number>(
      'incidents',
      (items) => ({ next: [...items, { id: 'inc-c' }], result: items.length + 1 }),
    )

    expect(appended).toBe(3)
    expect(JSON.parse(put.mock.calls.at(-1)![1] as string)).toEqual([
      { id: 'inc-a' },
      { id: 'inc-b' },
      { id: 'inc-c' },
    ])
  })

  it('reports contention as contention, not as a broken store', async () => {
    // The caller above this one degrades to a local copy when the store cannot
    // be reached. A busy store must not look like that, or a burst of reports
    // would cut the instance off from everyone else's data for good.
    // A fresh response per read: a body can only be consumed once, and the
    // retry reads again.
    get.mockImplementation(async () => found([]))
    put.mockRejectedValue(new Error('Precondition failed: ETag mismatch'))

    // Fake timers so the growing random backoff is not actually waited out.
    vi.useFakeTimers()
    try {
      const pending = createBlobAdapter().mutateCollection('incidents', (items) => ({
        next: items,
        result: null,
      }))
      const settled = expect(pending).rejects.toThrow(StoreContentionError)

      await vi.runAllTimersAsync()
      await settled
    } finally {
      vi.useRealTimers()
    }
  })
})
