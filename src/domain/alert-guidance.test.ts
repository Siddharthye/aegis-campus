import { describe, expect, it } from 'vitest'
import { guidanceFor } from './alert-guidance'
import type { IncidentCategory } from './types'

const CATEGORIES: IncidentCategory[] = [
  'fire',
  'medical',
  'harassment',
  'infrastructure',
  'security',
  'other',
]

describe('guidanceFor', () => {
  it('tells someone to get out of a fire, and not to use the lift', () => {
    const guidance = guidanceFor('fire', 'P0')
    expect(guidance.headline).toBe('Leave the building now')
    expect(guidance.steps.join(' ')).toMatch(/never a lift/i)
  })

  it('keeps a bystander from moving a casualty', () => {
    expect(guidanceFor('medical', 'P0').steps.join(' ')).toMatch(/do not move the person/i)
  })

  it('sends someone reporting harassment towards people, not away from them', () => {
    const guidance = guidanceFor('harassment', 'P1')
    expect(guidance.headline).toMatch(/lit and busy/i)
    expect(guidance.steps.join(' ')).toMatch(/do not confront/i)
  })

  it('does not tell anyone to evacuate for a low-priority incident', () => {
    // Crying wolf over a P2 water leak is how people learn to ignore the P0.
    const guidance = guidanceFor('fire', 'P2')
    expect(guidance.headline).toMatch(/no action needed/i)
    expect(guidance.steps.join(' ')).not.toMatch(/leave the building/i)
  })

  it('gives every category something usable at both urgent levels', () => {
    for (const category of CATEGORIES) {
      for (const severity of ['P0', 'P1'] as const) {
        const guidance = guidanceFor(category, severity)
        expect(guidance.headline.length).toBeGreaterThan(0)
        expect(guidance.steps.length).toBeGreaterThan(0)
        // Three is the most anyone reads while an alarm is going off.
        expect(guidance.steps.length).toBeLessThanOrEqual(3)
      }
    }
  })
})
