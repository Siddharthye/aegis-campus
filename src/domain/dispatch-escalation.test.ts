import { describe, expect, it } from 'vitest'
import {
  ESCALATION_LADDER,
  deadlinesFor,
  judgeAssignment,
  nextTier,
  requiresSpecialistRouting,
  type AssignmentState,
} from './dispatch-escalation'

const ASSIGNED_AT = '2026-08-22T10:00:00.000Z'
const at = (seconds: number) => new Date(Date.parse(ASSIGNED_AT) + seconds * 1_000)

const assignment = (overrides: Partial<AssignmentState> = {}): AssignmentState => ({
  severity: 'P0',
  assignedAt: ASSIGNED_AT,
  acknowledgedAt: null,
  tier: 'responder',
  ...overrides,
})

describe('deadlinesFor — DispatchGrid’s bands', () => {
  it('gives a P0 the 45 seconds their engine specifies', () => {
    expect(deadlinesFor('P0').ackSeconds).toBe(45)
    expect(deadlinesFor('P1').ackSeconds).toBe(90)
    expect(deadlinesFor('P2').ackSeconds).toBe(300)
    expect(deadlinesFor('P3').ackSeconds).toBe(900)
  })

  it('tightens every clock as severity rises', () => {
    const order = (['P3', 'P2', 'P1', 'P0'] as const).map((s) => deadlinesFor(s))
    for (let i = 1; i < order.length; i++) {
      expect(order[i].ackSeconds).toBeLessThan(order[i - 1].ackSeconds)
      expect(order[i].onSceneSeconds).toBeLessThan(order[i - 1].onSceneSeconds)
      expect(order[i].resolveSeconds).toBeLessThan(order[i - 1].resolveSeconds)
    }
  })
})

describe('nextTier', () => {
  it('climbs responder → supervisor → warden → chief', () => {
    expect(nextTier('responder')).toBe('supervisor')
    expect(nextTier('supervisor')).toBe('warden')
    expect(nextTier('warden')).toBe('chief')
  })

  it('stops at the top rather than wrapping around', () => {
    expect(nextTier('chief')).toBeNull()
    expect(ESCALATION_LADDER.at(-1)).toBe('chief')
  })
})

describe('judgeAssignment — silence is a signal', () => {
  it('holds while the responder still has time', () => {
    const verdict = judgeAssignment(assignment(), at(30))
    expect(verdict.overdue).toBe(false)
    expect(verdict.escalateTo).toBeNull()
    expect(verdict.reason).toContain('15s left')
  })

  it('escalates a silent P0 the moment its 45 seconds are up', () => {
    const verdict = judgeAssignment(assignment(), at(46))
    expect(verdict.overdue).toBe(true)
    expect(verdict.escalateTo).toBe('supervisor')
  })

  it('stops the clock permanently once acknowledged', () => {
    // The whole point: an answered assignment is handled by the incident's
    // own on-scene and resolve clocks, not by this ladder.
    const answered = assignment({ acknowledgedAt: at(10).toISOString() })
    const verdict = judgeAssignment(answered, at(9_999))
    expect(verdict.overdue).toBe(false)
    expect(verdict.escalateTo).toBeNull()
  })

  it('climbs one rung at a time as silence continues', () => {
    expect(judgeAssignment(assignment({ tier: 'supervisor' }), at(200)).escalateTo).toBe('warden')
    expect(judgeAssignment(assignment({ tier: 'warden' }), at(400)).escalateTo).toBe('chief')
  })

  it('says so plainly when the ladder is exhausted', () => {
    const verdict = judgeAssignment(assignment({ tier: 'chief' }), at(600))
    expect(verdict.overdue).toBe(true)
    expect(verdict.escalateTo).toBeNull()
    expect(verdict.reason).toContain('Escalate by phone')
  })

  it('gives a P3 its full fifteen minutes before complaining', () => {
    expect(judgeAssignment(assignment({ severity: 'P3' }), at(600)).overdue).toBe(false)
    expect(judgeAssignment(assignment({ severity: 'P3' }), at(901)).overdue).toBe(true)
  })

  it('reports how far past the deadline it is', () => {
    expect(judgeAssignment(assignment(), at(105)).overdueBySeconds).toBe(60)
  })
})

describe('requiresSpecialistRouting', () => {
  it('treats harassment as a hard constraint, not a preference', () => {
    // A survivor who asked for a counsellor and got whoever was nearest has
    // been failed by the dispatch, however fast it was.
    expect(requiresSpecialistRouting('harassment')).toBe(true)
    expect(requiresSpecialistRouting('fire')).toBe(false)
  })
})
