import { describe, expect, it } from 'vitest'
import {
  describeCaseStatus,
  generateCaseToken,
  hashCaseToken,
  normaliseCaseToken,
  toCaseStatus,
} from './case-token'
import type { Incident } from './types'

describe('generateCaseToken', () => {
  it('produces the documented readable shape', () => {
    expect(generateCaseToken()).toMatch(/^AEG-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
  })

  it('excludes characters that get misread when written by hand', () => {
    const sample = Array.from({ length: 200 }, generateCaseToken).join('')
    // No O/0, I/1 or S/5 confusion in a token someone scribbles on their hand.
    expect(sample).not.toMatch(/[OIS015]/)
  })

  it('does not repeat itself', () => {
    const tokens = new Set(Array.from({ length: 500 }, generateCaseToken))
    expect(tokens.size).toBe(500)
  })
})

describe('normaliseCaseToken', () => {
  it('accepts the token exactly as it was displayed', () => {
    expect(normaliseCaseToken('AEG-7K2M-QP49')).toBe('AEG-7K2M-QP49')
  })

  it('forgives lower case, missing dashes and stray spaces', () => {
    expect(normaliseCaseToken('aeg7k2mqp49')).toBe('AEG-7K2M-QP49')
    expect(normaliseCaseToken(' aeg 7k2m qp49 ')).toBe('AEG-7K2M-QP49')
    expect(normaliseCaseToken('AEG7K2MQP49')).toBe('AEG-7K2M-QP49')
  })

  it('normalises a round trip from generate', () => {
    const token = generateCaseToken()
    expect(normaliseCaseToken(token.toLowerCase().replace(/-/g, ''))).toBe(token)
  })
})

describe('hashCaseToken', () => {
  it('matches regardless of how the reporter typed it', async () => {
    const strict = await hashCaseToken('AEG-7K2M-QP49')
    const sloppy = await hashCaseToken(' aeg7k2m qp49 ')
    expect(sloppy).toBe(strict)
  })

  it('differs for different tokens', async () => {
    expect(await hashCaseToken('AEG-7K2M-QP49')).not.toBe(await hashCaseToken('AEG-7K2M-QP48'))
  })

  it('is a 64-character hex digest that reveals nothing of the token', async () => {
    const hash = await hashCaseToken('AEG-7K2M-QP49')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toContain('7K2M')
  })
})

describe('toCaseStatus', () => {
  const incident = {
    id: 'inc-secret',
    category: 'harassment',
    severity: 'P1',
    status: 'dispatched',
    title: 'Internal title',
    description: 'Internal description a reporter must not read back',
    location: { lat: 20.35, lng: 85.81, label: 'Gate 3', method: 'gps', confidence: 0.4 },
    reporterId: null,
    reportCount: 7,
    confidence: 0.83,
    assignedResponderIds: ['resp-sec-1'],
    createdAt: '2026-08-21T10:00:00.000Z',
    resolvedAt: null,
    isDrill: false,
    caseTokenHash: 'deadbeef',
    timeline: [
      { at: '2026-08-21T10:00:00.000Z', actor: 'anonymous', action: 'reported' },
      { at: '2026-08-21T10:01:00.000Z', actor: 'fusion', action: 'corroborated', detail: '7 reports at 83%' },
      { at: '2026-08-21T10:02:00.000Z', actor: 'system', action: 'escalated', detail: 'P2 → P1' },
      { at: '2026-08-21T10:03:00.000Z', actor: 'dispatcher', action: 'dispatched', detail: 'A. Pradhan' },
      { at: '2026-08-21T10:04:00.000Z', actor: 'dispatcher', action: 'broadcast', detail: 'Internal comms' },
    ],
  } as Incident

  it('exposes only reporter-safe fields', () => {
    expect(Object.keys(toCaseStatus(incident)).sort()).toEqual([
      'category',
      'createdAt',
      'locationLabel',
      'resolvedAt',
      'severity',
      'status',
      'updates',
    ])
  })

  it('never leaks the incident id, description or token hash', () => {
    const serialised = JSON.stringify(toCaseStatus(incident))
    expect(serialised).not.toContain('inc-secret')
    expect(serialised).not.toContain('Internal description')
    expect(serialised).not.toContain('deadbeef')
  })

  it('hides internal operational chatter from an unauthenticated endpoint', () => {
    const actions = toCaseStatus(incident).updates.map((update) => update.action)
    // Corroboration counts, escalation reasoning and broadcast copy are ours.
    expect(actions).toEqual(['reported', 'dispatched'])
  })

  it('strips the actor from every update it does show', () => {
    for (const update of toCaseStatus(incident).updates) {
      expect(Object.keys(update).sort()).toEqual(['action', 'at'])
    }
  })
})

describe('describeCaseStatus', () => {
  it('answers in a sentence a worried person can read', () => {
    expect(describeCaseStatus('dispatched')).toBe('A responder is on the way.')
  })

  it('covers every status the pipeline can reach', () => {
    for (const status of ['reported', 'triaged', 'dispatched', 'on-scene', 'resolved'] as const) {
      expect(describeCaseStatus(status).length).toBeGreaterThan(0)
    }
  })
})
