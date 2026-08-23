import { beforeEach, describe, expect, it, vi } from 'vitest'

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
