import { describe, expect, it } from 'vitest'
import {
  MEDICAL_DISCLAIMER,
  REACH_TARGET_SECONDS,
  triageMedical,
  type MedicalReport,
} from './medical-triage'

/** A report with nothing wrong in it, so each test states only what matters. */
const report = (overrides: Partial<MedicalReport> = {}): MedicalReport => ({
  responsive: true,
  breathing: 'normal',
  bleeding: 'none',
  findings: [],
  peopleAffected: 1,
  ageGroup: 'adult',
  ...overrides,
})

describe('triageMedical — the absolute red flags', () => {
  it('sets P0 when the person is not breathing', () => {
    const result = triageMedical(report({ breathing: 'absent' }))
    expect(result.priority).toBe('P0')
    expect(result.reasons.some((reason) => reason.forced)).toBe(true)
  })

  it('treats gasping as not breathing', () => {
    // Agonal breathing looks like breathing to a frightened bystander and is
    // not. Getting this wrong is the difference between P0 and P3.
    expect(triageMedical(report({ breathing: 'gasping' })).priority).toBe('P0')
  })

  it('sets P0 when unresponsive, and when bleeding severely', () => {
    expect(triageMedical(report({ responsive: false })).priority).toBe('P0')
    expect(triageMedical(report({ bleeding: 'severe' })).priority).toBe('P0')
  })

  it('lets one fatal finding override every reassuring answer', () => {
    // The whole reason this is a cascade and not an average.
    const result = triageMedical(
      report({ responsive: true, breathing: 'absent', bleeding: 'none', ageGroup: 'adult' }),
    )
    expect(result.priority).toBe('P0')
  })
})

describe('triageMedical — the graded findings', () => {
  it('puts chest pain and stroke signs at P1', () => {
    expect(triageMedical(report({ findings: ['chest_pain'] })).priority).toBe('P1')
    expect(triageMedical(report({ findings: ['stroke_signs'] })).priority).toBe('P1')
  })

  it('puts a burn or fracture at P2', () => {
    expect(triageMedical(report({ findings: ['burn'] })).priority).toBe('P2')
    expect(triageMedical(report({ findings: ['fracture'] })).priority).toBe('P2')
  })

  it('leaves a report with no red flags at P3, and says so', () => {
    const result = triageMedical(report())
    expect(result.priority).toBe('P3')
    expect(result.reasons[0].code).toBe('no_red_flags')
  })
})

describe('triageMedical — unknowns are risk, not reassurance', () => {
  it('raises a report where the state cannot be confirmed', () => {
    // Someone who cannot tell whether the person is breathing is describing a
    // worse situation than someone who can confirm they are.
    const result = triageMedical(report({ responsive: null, breathing: 'unknown' }))
    expect(result.priority).toBe('P2')
    expect(result.reasons.some((reason) => reason.code === 'unknown_state')).toBe(true)
  })

  it('does not downgrade a real red flag just because other answers are unknown', () => {
    expect(triageMedical(report({ responsive: null, breathing: 'absent' })).priority).toBe('P0')
  })
})

describe('triageMedical — modifiers', () => {
  it('raises a mass-casualty report to at least P1', () => {
    const result = triageMedical(report({ peopleAffected: 4 }))
    expect(result.priority).toBe('P1')
    expect(result.requiredSkills).toContain('incident_command')
  })

  it('raises a child or older adult one level', () => {
    expect(triageMedical(report({ ageGroup: 'child' })).priority).toBe('P1')
    expect(triageMedical(report({ ageGroup: 'older_adult' })).priority).toBe('P1')
  })

  it('never lets a modifier soften something already worse', () => {
    // A modifier may only raise. A child who is not breathing stays P0.
    expect(triageMedical(report({ ageGroup: 'child', breathing: 'absent' })).priority).toBe('P0')
    expect(triageMedical(report({ peopleAffected: 9, bleeding: 'severe' })).priority).toBe('P0')
  })

  it('still sends someone to a person who fainted and recovered', () => {
    expect(triageMedical(report({ findings: ['fainted_now_recovered'] })).priority).toBe('P2')
  })
})

describe('triageMedical — what comes out with the priority', () => {
  it('asks for an AED-trained responder on a P0', () => {
    const result = triageMedical(report({ breathing: 'absent' }))
    expect(result.requiredSkills).toContain('aed_trained')
    expect(result.requiredSkills).toContain('first_aid')
  })

  it('carries the reach target for the priority it decided', () => {
    expect(triageMedical(report({ breathing: 'absent' })).reachTargetSeconds).toBe(
      REACH_TARGET_SECONDS.P0,
    )
    expect(triageMedical(report()).reachTargetSeconds).toBe(REACH_TARGET_SECONDS.P3)
  })

  it('always explains itself, so a duty officer can overrule it', () => {
    const result = triageMedical(report({ breathing: 'difficult', findings: ['chest_pain'] }))
    expect(result.reasons.length).toBeGreaterThan(1)
    for (const reason of result.reasons) expect(reason.detail).not.toBe('')
  })

  it('tightens the reach target as priority rises', () => {
    const order = (['P3', 'P2', 'P1', 'P0'] as const).map((p) => REACH_TARGET_SECONDS[p])
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeLessThan(order[i - 1])
  })
})

describe('MEDICAL_DISCLAIMER', () => {
  it('tells the reporter to call emergency services first', () => {
    // VitalPath opens every response with this, and it is the reason the
    // module is safe to ship: it triages urgency, it does not diagnose.
    expect(MEDICAL_DISCLAIMER).toContain('Call emergency services')
    expect(MEDICAL_DISCLAIMER).toContain('not medical advice')
  })
})
