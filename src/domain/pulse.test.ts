import { describe, expect, it } from 'vitest'
import {
  buildDemoHistory,
  heatCalendar,
  hotspotRanking,
  mttrByCategory,
  patrolRecommendations,
  slaScorecard,
} from './pulse'
import { readSla, SLA_TARGET_MINUTES } from './sla'
import type { Incident, IncidentCategory, Severity } from './types'

const at = (iso: string) => new Date(iso)

const incident = (
  overrides: Partial<Incident> & { createdAt: string },
): Incident =>
  ({
    id: `inc-${overrides.createdAt}`,
    category: 'security',
    severity: 'P2',
    status: 'resolved',
    location: { lat: 20.3536, lng: 85.8195, label: 'x', method: 'gps', confidence: 0.4 },
    reporterId: null,
    reportCount: 1,
    confidence: 0.5,
    assignedResponderIds: [],
    resolvedAt: null,
    timeline: [],
    isDrill: false,
    ...overrides,
  }) as Incident

describe('readSla', () => {
  it('stops the clock at resolution for a closed incident', () => {
    const closed = incident({
      severity: 'P0',
      createdAt: '2026-08-21T10:00:00.000Z',
      resolvedAt: '2026-08-21T10:03:00.000Z',
    })
    // Hours later, the reading must still be the 3 minutes it actually took.
    const reading = readSla(closed, at('2026-08-21T18:00:00.000Z'))

    expect(reading.elapsedMinutes).toBeCloseTo(3, 5)
    expect(reading.breached).toBe(false)
  })

  it('keeps the clock running on an open incident', () => {
    const open = incident({ severity: 'P0', createdAt: '2026-08-21T10:00:00.000Z' })
    const reading = readSla(open, at('2026-08-21T10:07:00.000Z'))

    expect(reading.elapsedMinutes).toBeCloseTo(7, 5)
    expect(reading.remainingMinutes).toBeCloseTo(-2, 5)
    expect(reading.breached).toBe(true)
  })

  it('uses a tighter target the more severe the incident', () => {
    expect(SLA_TARGET_MINUTES.P0).toBeLessThan(SLA_TARGET_MINUTES.P1)
    expect(SLA_TARGET_MINUTES.P1).toBeLessThan(SLA_TARGET_MINUTES.P2)
    expect(SLA_TARGET_MINUTES.P2).toBeLessThan(SLA_TARGET_MINUTES.P3)
  })
})

describe('heatCalendar', () => {
  it('buckets by local weekday and hour', () => {
    // 2026-08-18 is a Tuesday (weekday 2).
    const matrix = heatCalendar([incident({ createdAt: '2026-08-18T21:30:00.000Z' })])
    const created = new Date('2026-08-18T21:30:00.000Z')

    expect(matrix[created.getDay()][created.getHours()]).toBe(1)
  })

  it('is always a full 7 × 24 grid, even with no data', () => {
    const matrix = heatCalendar([])
    expect(matrix).toHaveLength(7)
    for (const row of matrix) expect(row).toHaveLength(24)
    expect(matrix.flat().every((cell) => cell === 0)).toBe(true)
  })
})

describe('hotspotRanking', () => {
  it('ranks buildings by incident count, busiest first', () => {
    const incidents = [
      ...Array.from({ length: 3 }, (_, index) =>
        incident({
          createdAt: `2026-08-2${index}T10:00:00.000Z`,
          location: { lat: 0, lng: 0, label: 'x', method: 'gps', confidence: 0.4, buildingId: 'hostel-9' },
        }),
      ),
      incident({
        createdAt: '2026-08-20T10:00:00.000Z',
        location: { lat: 0, lng: 0, label: 'x', method: 'gps', confidence: 0.4, buildingId: 'library' },
      }),
    ]

    const ranked = hotspotRanking(incidents, at('2026-08-21T12:00:00.000Z'))
    expect(ranked[0].buildingId).toBe('hostel-9')
    expect(ranked[0].count).toBe(3)
  })

  it('attributes a GPS-only report to the nearest building rather than dropping it', () => {
    const ranked = hotspotRanking(
      [incident({ createdAt: '2026-08-20T10:00:00.000Z' })],
      at('2026-08-21T12:00:00.000Z'),
    )
    // No buildingId on the fixture, so it must still land somewhere patrollable.
    expect(ranked).toHaveLength(1)
    expect(ranked[0].buildingId).toBeTruthy()
  })
})

describe('mttrByCategory', () => {
  it('averages only resolved incidents', () => {
    const entries = mttrByCategory([
      incident({
        category: 'fire',
        createdAt: '2026-08-21T10:00:00.000Z',
        resolvedAt: '2026-08-21T10:20:00.000Z',
      }),
      incident({ category: 'fire', createdAt: '2026-08-21T11:00:00.000Z', resolvedAt: null }),
    ])

    expect(entries).toHaveLength(1)
    expect(entries[0].resolvedCount).toBe(1)
    expect(entries[0].meanMinutes).toBe(20)
  })

  it('omits categories with nothing resolved, because a mean of nothing lies', () => {
    expect(mttrByCategory([incident({ createdAt: '2026-08-21T10:00:00.000Z', resolvedAt: null })])).toEqual([])
  })
})

describe('slaScorecard', () => {
  it('always reports all four severities in order', () => {
    const severities = slaScorecard([], at('2026-08-21T12:00:00.000Z')).map((score) => score.severity)
    expect(severities).toEqual<Severity[]>(['P0', 'P1', 'P2', 'P3'])
  })

  it('scores an empty band as a perfect rate rather than dividing by zero', () => {
    const [p0] = slaScorecard([], at('2026-08-21T12:00:00.000Z'))
    expect(p0.total).toBe(0)
    expect(p0.rate).toBe(1)
  })

  it('counts a breach against its own band', () => {
    const scores = slaScorecard(
      [
        incident({
          severity: 'P0',
          createdAt: '2026-08-21T10:00:00.000Z',
          resolvedAt: '2026-08-21T10:30:00.000Z',
        }),
      ],
      at('2026-08-21T12:00:00.000Z'),
    )
    const p0 = scores.find((score) => score.severity === 'P0')!
    expect(p0.breached).toBe(1)
    expect(p0.rate).toBe(0)
  })
})

describe('patrolRecommendations', () => {
  it('needs a repeat before it recommends anything', () => {
    expect(patrolRecommendations([incident({ createdAt: '2026-08-18T21:00:00.000Z' })])).toEqual([])
  })

  it('surfaces a recurring building and time window as an instruction', () => {
    const repeats = Array.from({ length: 4 }, (_, index) =>
      incident({
        category: 'harassment' as IncidentCategory,
        createdAt: `2026-08-1${index + 4}T21:${10 + index}:00.000Z`,
        location: {
          lat: 0, lng: 0, label: 'x', method: 'gps', confidence: 0.4, buildingId: 'hostel-9',
        },
      }),
    )

    const [top] = patrolRecommendations(repeats)
    expect(top.buildingId).toBe('hostel-9')
    expect(top.count).toBe(4)
    expect(top.headline).toContain('baseline')
    expect(top.multiplier).toBeGreaterThanOrEqual(1)
  })
})

describe('buildDemoHistory', () => {
  it('is deterministic for a seed, so every machine shows the same analytics', () => {
    const until = at('2026-08-21T12:00:00.000Z')
    const first = buildDemoHistory(20260821, until)
    const second = buildDemoHistory(20260821, until)

    expect(first.map((entry) => entry.id + entry.createdAt)).toEqual(
      second.map((entry) => entry.id + entry.createdAt),
    )
  })

  it('differs between seeds', () => {
    const until = at('2026-08-21T12:00:00.000Z')
    expect(buildDemoHistory(1, until)[0].createdAt).not.toBe(buildDemoHistory(2, until)[0].createdAt)
  })

  it('never fabricates an incident in the future', () => {
    const until = at('2026-08-21T12:00:00.000Z')
    for (const entry of buildDemoHistory(20260821, until)) {
      expect(new Date(entry.createdAt).getTime()).toBeLessThanOrEqual(until.getTime())
    }
  })

  it('labels every synthetic row so it can never be mistaken for real data', () => {
    for (const entry of buildDemoHistory(20260821, at('2026-08-21T12:00:00.000Z'))) {
      expect(entry.id).toMatch(/^inc-sim-/)
      expect(entry.reporterId).toBe('pulse-sim')
    }
  })
})
