import { describe, expect, it } from 'vitest'
import {
  MAX_DELIVERY_ATTEMPTS,
  MAX_QUEUE_AGE_MS,
  MAX_QUEUE_LENGTH,
  dropReport,
  enqueueReport,
  markAttempt,
  parseQueue,
  pendingReports,
  pruneQueue,
  type QueuedReport,
} from './offline-queue'

const NOW = new Date('2026-08-21T12:00:00.000Z')

const report = (id: string, overrides: Partial<QueuedReport> = {}): QueuedReport => ({
  id,
  body: { title: id },
  queuedAt: NOW.toISOString(),
  attempts: 0,
  ...overrides,
})

describe('enqueueReport', () => {
  it('appends to the queue', () => {
    expect(enqueueReport([report('a')], report('b')).map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('drops the oldest when full, keeping the freshest picture of reality', () => {
    const full = Array.from({ length: MAX_QUEUE_LENGTH }, (_, index) => report(`q${index}`))
    const result = enqueueReport(full, report('newest'))

    expect(result).toHaveLength(MAX_QUEUE_LENGTH)
    expect(result.at(-1)?.id).toBe('newest')
    expect(result.some((item) => item.id === 'q0')).toBe(false)
  })
})

describe('dropReport', () => {
  it('removes a delivered report and leaves the rest', () => {
    expect(dropReport([report('a'), report('b')], 'a').map((item) => item.id)).toEqual(['b'])
  })

  it('is a no-op for an unknown id', () => {
    expect(dropReport([report('a')], 'missing')).toHaveLength(1)
  })
})

describe('markAttempt', () => {
  it('counts the failure and records why', () => {
    const [marked] = markAttempt([report('a')], 'a', 'network unreachable')
    expect(marked.attempts).toBe(1)
    expect(marked.lastError).toBe('network unreachable')
  })

  it('accumulates across repeated failures', () => {
    let queue = [report('a')]
    queue = markAttempt(queue, 'a', 'first')
    queue = markAttempt(queue, 'a', 'second')

    expect(queue[0].attempts).toBe(2)
    expect(queue[0].lastError).toBe('second')
  })

  it('touches only the named report', () => {
    const queue = markAttempt([report('a'), report('b')], 'a', 'x')
    expect(queue.find((item) => item.id === 'b')?.attempts).toBe(0)
  })
})

describe('pruneQueue', () => {
  it('keeps a recent report', () => {
    const recent = report('fresh', { queuedAt: new Date(NOW.getTime() - 60_000).toISOString() })
    expect(pruneQueue([recent], NOW)).toHaveLength(1)
  })

  it('drops a report older than the retention window', () => {
    // A day-old emergency report is not actionable; holding it forever is worse.
    const stale = report('stale', {
      queuedAt: new Date(NOW.getTime() - MAX_QUEUE_AGE_MS - 1000).toISOString(),
    })
    expect(pruneQueue([stale], NOW)).toHaveLength(0)
  })

  it('drops a report that has exhausted its attempts', () => {
    const doomed = report('doomed', { attempts: MAX_DELIVERY_ATTEMPTS })
    expect(pruneQueue([doomed], NOW)).toHaveLength(0)
  })

  it('keeps a report still within both limits', () => {
    expect(pruneQueue([report('ok', { attempts: MAX_DELIVERY_ATTEMPTS - 1 })], NOW)).toHaveLength(1)
  })
})

describe('pendingReports', () => {
  it('excludes anything that has given up', () => {
    const queue = [report('live'), report('dead', { attempts: MAX_DELIVERY_ATTEMPTS })]
    expect(pendingReports(queue).map((item) => item.id)).toEqual(['live'])
  })
})

describe('parseQueue', () => {
  it('round-trips a stored queue', () => {
    const queue = [report('a'), report('b')]
    expect(parseQueue(JSON.stringify(queue))).toEqual(queue)
  })

  it('degrades to empty rather than throwing on corrupt storage', () => {
    // The report screen must open even if localStorage holds junk.
    expect(parseQueue('not json at all')).toEqual([])
    expect(parseQueue('{"not":"an array"}')).toEqual([])
    expect(parseQueue(null)).toEqual([])
  })

  it('discards malformed entries but keeps good ones', () => {
    const mixed = JSON.stringify([report('good'), { id: 'bad' }, null, 42])
    expect(parseQueue(mixed).map((item) => item.id)).toEqual(['good'])
  })
})
