import { describe, expect, it } from 'vitest'
import { alertsFrom, describeAge, isCurrent, type CampusAlert } from './campus-alerts'
import type { Incident, TimelineEntry } from './types'

const NOW = new Date('2026-08-23T12:00:00.000Z')

const entry = (action: string, detail: string, minutesAgo: number): TimelineEntry => ({
  at: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(),
  actor: 'dispatcher',
  action,
  detail,
})

const incident = (overrides: Partial<Incident> = {}): Incident =>
  ({
    id: 'inc-1',
    category: 'fire',
    severity: 'P0',
    status: 'dispatched',
    title: 'Fire in B Block',
    description: '',
    location: { lat: 20.35, lng: 85.81, label: 'B Block · Floor 2', method: 'gps', confidence: 0.4 },
    reporterId: 'student-1',
    reportCount: 1,
    assignedResponderIds: [],
    createdAt: NOW.toISOString(),
    resolvedAt: null,
    isDrill: false,
    timeline: [],
    ...overrides,
  }) as Incident

describe('alertsFrom', () => {
  it('picks the broadcasts out of the audit trail', () => {
    const alerts = alertsFrom([
      incident({
        timeline: [
          entry('reported', 'B Block', 30),
          entry('broadcast', 'Evacuate B Block via the west stairwell.', 10),
        ],
      }),
    ])

    expect(alerts).toHaveLength(1)
    expect(alerts[0].message).toBe('Evacuate B Block via the west stairwell.')
    expect(alerts[0].severity).toBe('P0')
    expect(alerts[0].category).toBe('fire')
    expect(alerts[0].place).toBe('B Block')
    expect(alerts[0].at).toEqual({ lat: 20.35, lng: 85.81 })
  })

  it('ignores every timeline entry that is not a broadcast', () => {
    const alerts = alertsFrom([
      incident({ timeline: [entry('reported', 'x', 5), entry('dispatched', 'K. Das', 4)] }),
    ])
    expect(alerts).toEqual([])
  })

  it('never lets a drill reach a student', () => {
    // A rehearsal that looks exactly like a real evacuation order is the one
    // thing this screen must not do.
    const alerts = alertsFrom([
      incident({ isDrill: true, timeline: [entry('broadcast', 'Evacuate now', 2)] }),
    ])
    expect(alerts).toEqual([])
  })

  it('puts the newest alert first, across incidents', () => {
    const alerts = alertsFrom([
      incident({ id: 'inc-old', timeline: [entry('broadcast', 'older', 40)] }),
      incident({ id: 'inc-new', timeline: [entry('broadcast', 'newer', 2)] }),
    ])
    expect(alerts.map((alert) => alert.message)).toEqual(['newer', 'older'])
  })

  it('keeps repeat broadcasts on one incident apart', () => {
    // Two updates on the same fire are two things the campus was told.
    const alerts = alertsFrom([
      incident({
        timeline: [entry('broadcast', 'Evacuate', 20), entry('broadcast', 'All clear', 1)],
      }),
    ])
    expect(alerts).toHaveLength(2)
    expect(new Set(alerts.map((alert) => alert.id)).size).toBe(2)
    expect(alerts[0].message).toBe('All clear')
  })
})

describe('isCurrent', () => {
  const at = (hoursAgo: number): CampusAlert => ({
    id: 'a',
    incidentId: 'inc-1',
    message: 'Evacuate',
    severity: 'P0',
    category: 'fire',
    place: 'B Block',
    at: { lat: 20.35, lng: 85.81 },
    sentAt: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(),
  })

  it('treats a recent order as current and yesterday’s as history', () => {
    // An evacuation order from yesterday is history, not an instruction.
    expect(isCurrent(at(1), NOW)).toBe(true)
    expect(isCurrent(at(25), NOW)).toBe(false)
  })
})

describe('describeAge', () => {
  const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString()

  it('reads the way someone glancing at a phone would say it', () => {
    expect(describeAge(ago(5), NOW)).toBe('just now')
    expect(describeAge(ago(300), NOW)).toBe('5 min ago')
    expect(describeAge(ago(7_200), NOW)).toBe('2 hr ago')
    expect(describeAge(ago(172_800), NOW)).toBe('2 days ago')
  })

  it('never reports a negative age from a clock that is slightly ahead', () => {
    expect(describeAge(new Date(NOW.getTime() + 5_000).toISOString(), NOW)).toBe('just now')
  })
})
