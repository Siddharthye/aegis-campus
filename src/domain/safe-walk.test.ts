import { describe, expect, it } from 'vitest'
import {
  CHECK_IN_INTERVAL_MS,
  ETA_GRACE_MS,
  escalationReason,
  isOverdue,
  missedCheckIns,
  nextCheckInDueAt,
  shouldEscalate,
  walkProgress,
  type SafeWalk,
  type SafeWalkStatus,
} from './safe-walk'

const START = new Date('2026-08-21T22:00:00.000Z')

const walk = (overrides: Partial<SafeWalk> = {}): SafeWalk => ({
  id: 'walk-1',
  startedAt: START.toISOString(),
  destination: 'Hostel 8',
  expectedMinutes: 10,
  lastCheckInAt: START.toISOString(),
  status: 'walking',
  path: [{ lat: 20.3536, lng: 85.8195 }],
  sentinelSessionId: null,
  trustedContacts: [],
  ...overrides,
})

const minutesAfterStart = (minutes: number) => new Date(START.getTime() + minutes * 60_000)

describe('missedCheckIns', () => {
  it('counts nothing while the walker is responding', () => {
    expect(missedCheckIns(walk(), START)).toBe(0)
  })

  it('counts a whole interval of silence as one missed check-in', () => {
    const now = new Date(START.getTime() + CHECK_IN_INTERVAL_MS)
    expect(missedCheckIns(walk(), now)).toBe(1)
  })

  it('accumulates across intervals', () => {
    const now = new Date(START.getTime() + CHECK_IN_INTERVAL_MS * 3)
    expect(missedCheckIns(walk(), now)).toBe(3)
  })
})

describe('nextCheckInDueAt', () => {
  it('is one interval after the last confirmed contact', () => {
    expect(nextCheckInDueAt(walk()).getTime()).toBe(START.getTime() + CHECK_IN_INTERVAL_MS)
  })
})

describe('isOverdue', () => {
  it('allows the stated duration plus grace before calling anyone overdue', () => {
    // People stop to talk. A few minutes over is life, not an emergency.
    expect(isOverdue(walk(), minutesAfterStart(10))).toBe(false)
    expect(isOverdue(walk(), minutesAfterStart(14))).toBe(false)
  })

  it('is overdue once the ETA and its grace are both spent', () => {
    const past = new Date(START.getTime() + 10 * 60_000 + ETA_GRACE_MS + 1000)
    expect(isOverdue(walk(), past)).toBe(true)
  })
})

describe('shouldEscalate', () => {
  it('escalates after two missed check-ins, even while inside the ETA', () => {
    const now = new Date(START.getTime() + CHECK_IN_INTERVAL_MS * 2)
    expect(isOverdue(walk(), now)).toBe(false)
    expect(shouldEscalate(walk(), now)).toBe(true)
  })

  it('escalates on a bad overrun even if check-ins kept arriving', () => {
    // Someone tapping "I'm fine" out of habit is a different failure mode.
    const late = new Date(START.getTime() + 10 * 60_000 + ETA_GRACE_MS + 60_000)
    const responsive = walk({ lastCheckInAt: late.toISOString() })

    expect(missedCheckIns(responsive, late)).toBe(0)
    expect(shouldEscalate(responsive, late)).toBe(true)
  })

  it('holds off after only one missed check-in', () => {
    const now = new Date(START.getTime() + CHECK_IN_INTERVAL_MS)
    expect(shouldEscalate(walk(), now)).toBe(false)
  })

  it('never escalates a walk that is already finished', () => {
    const long = new Date(START.getTime() + 60 * 60_000)
    for (const status of ['arrived', 'cancelled', 'escalated'] as SafeWalkStatus[]) {
      expect(shouldEscalate(walk({ status }), long)).toBe(false)
    }
  })
})

describe('escalationReason', () => {
  it('names silence when that is what triggered it', () => {
    const now = new Date(START.getTime() + CHECK_IN_INTERVAL_MS * 2)
    expect(escalationReason(walk(), now)).toBe('No check-in for 6 minutes while walking to Hostel 8.')
  })

  it('names the overrun when check-ins were fine', () => {
    const late = new Date(START.getTime() + 10 * 60_000 + ETA_GRACE_MS + 60_000)
    const responsive = walk({ lastCheckInAt: late.toISOString() })

    expect(escalationReason(responsive, late)).toBe(
      'Overdue arriving at Hostel 8 — expected within 10 minutes.',
    )
  })
})

describe('walkProgress', () => {
  it('runs from zero to one across the stated duration', () => {
    expect(walkProgress(walk(), START)).toBe(0)
    expect(walkProgress(walk(), minutesAfterStart(5))).toBeCloseTo(0.5, 5)
    expect(walkProgress(walk(), minutesAfterStart(10))).toBe(1)
  })

  it('clamps rather than overflowing once overdue', () => {
    expect(walkProgress(walk(), minutesAfterStart(45))).toBe(1)
  })
})
