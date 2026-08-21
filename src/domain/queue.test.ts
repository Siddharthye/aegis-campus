import { describe, expect, it } from 'vitest'
import { describeSlaClock, rankByPressure } from './queue'
import type { Incident, IncidentStatus, Severity } from './types'

const NOW = new Date('2026-08-21T12:00:00.000Z')

const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString()

const incident = (
  id: string,
  severity: Severity,
  ageMinutes: number,
  status: IncidentStatus = 'reported',
): Incident =>
  ({
    id,
    severity,
    status,
    createdAt: minutesAgo(ageMinutes),
    resolvedAt: status === 'resolved' ? minutesAgo(0) : null,
  }) as Incident

describe('rankByPressure', () => {
  it('puts a fresh P0 above a long-waiting P2', () => {
    const queue = rankByPressure([incident('old-p2', 'P2', 45), incident('new-p0', 'P0', 0)], NOW)
    expect(queue[0].incident.id).toBe('new-p0')
  })

  it('orders within a severity band by how much of the clock is gone', () => {
    const queue = rankByPressure([incident('fresh', 'P1', 1), incident('stale', 'P1', 9)], NOW)
    expect(queue.map((entry) => entry.incident.id)).toEqual(['stale', 'fresh'])
  })

  it('drops resolved incidents — they need nothing from a dispatcher', () => {
    const queue = rankByPressure(
      [incident('done', 'P0', 30, 'resolved'), incident('open', 'P3', 1)],
      NOW,
    )
    expect(queue.map((entry) => entry.incident.id)).toEqual(['open'])
  })

  it('flags breaches once an incident is past its own target', () => {
    // P1 targets 10 minutes.
    const [breached, safe] = rankByPressure(
      [incident('late', 'P1', 12), incident('ok', 'P1', 4)],
      NOW,
    )
    expect(breached.breached).toBe(true)
    expect(safe.breached).toBe(false)
  })

  it('reports remaining minutes as negative once overdue', () => {
    const [entry] = rankByPressure([incident('late', 'P0', 8)], NOW)
    // P0 targets 5 minutes, so 8 minutes in leaves -3.
    expect(entry.minutesRemaining).toBeCloseTo(-3, 5)
  })

  it('measures pressure as the fraction of the target consumed', () => {
    const [entry] = rankByPressure([incident('half', 'P2', 15)], NOW)
    // P2 targets 30 minutes.
    expect(entry.pressure).toBeCloseTo(0.5, 5)
  })

  it('returns an empty queue for an empty board', () => {
    expect(rankByPressure([], NOW)).toEqual([])
  })
})

describe('describeSlaClock', () => {
  it('reads as time left while inside the target', () => {
    expect(describeSlaClock(4)).toBe('4m left')
  })

  it('reads as overdue rather than as a negative number', () => {
    expect(describeSlaClock(-4.2)).toBe('4m overdue')
  })

  it('keeps one decimal under a minute, where the difference matters', () => {
    expect(describeSlaClock(0.4)).toBe('0.4m left')
  })
})
