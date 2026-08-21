import { describe, expect, it } from 'vitest'
import { escalationRationale, moreUrgentSeverity, severityFromCorroboration } from './corroboration'
import type { Severity } from './types'

describe('severityFromCorroboration', () => {
  it('escalates to P0 when a mass of reports corroborates at high confidence', () => {
    expect(severityFromCorroboration('P2', 21, 0.96)).toBe('P0')
  })

  it('walks the ladder rather than jumping straight to P0', () => {
    expect(severityFromCorroboration('P2', 14, 0.89)).toBe('P1')
    expect(severityFromCorroboration('P3', 6, 0.72)).toBe('P2')
  })

  it('needs both volume and confidence, not either alone', () => {
    // Plenty of reports, but the fusion engine is not convinced they match.
    expect(severityFromCorroboration('P2', 40, 0.5)).toBe('P2')
    // Highly confident, but it is still one person.
    expect(severityFromCorroboration('P2', 2, 0.99)).toBe('P2')
  })

  it('never de-escalates a dispatcher decision', () => {
    // A human escalated to P0; arriving duplicates must not walk it back.
    expect(severityFromCorroboration('P0', 1, 0.1)).toBe('P0')
    expect(severityFromCorroboration('P1', 6, 0.72)).toBe('P1')
  })

  it('is idempotent once the ceiling is reached', () => {
    const once = severityFromCorroboration('P2', 21, 0.96)
    expect(severityFromCorroboration(once, 21, 0.96)).toBe(once)
  })
})

describe('escalationRationale', () => {
  it('states the evidence in the terms a panel will ask about', () => {
    expect(escalationRationale(21, 0.96)).toBe('21 corroborating reports at 96% confidence')
  })

  it('renders confidence as whole percent, not a float', () => {
    expect(escalationRationale(3, 0.8333)).toBe('3 corroborating reports at 83% confidence')
  })
})

describe('moreUrgentSeverity', () => {
  it('picks the more alarming of two verdicts', () => {
    expect(moreUrgentSeverity('P2', 'P0')).toBe('P0')
    expect(moreUrgentSeverity('P0', 'P2')).toBe('P0')
    expect(moreUrgentSeverity('P3', 'P1')).toBe('P1')
  })

  it('is stable when both agree', () => {
    expect(moreUrgentSeverity('P1', 'P1')).toBe('P1')
  })

  it('is order-independent', () => {
    const severities: Severity[] = ['P0', 'P1', 'P2', 'P3']
    for (const a of severities) {
      for (const b of severities) {
        expect(moreUrgentSeverity(a, b)).toBe(moreUrgentSeverity(b, a))
      }
    }
  })
})
