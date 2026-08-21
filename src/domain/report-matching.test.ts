import { describe, expect, it } from 'vitest'
import {
  FUSE_WINDOW_MS,
  MAX_FUSE_DISTANCE_M,
  findFusionCandidate,
  jaccardSimilarity,
  scoreMatch,
  tokenize,
  type IncomingReport,
} from './report-matching'
import type { Incident, IncidentCategory, IncidentStatus } from './types'

const CENTRE = { lat: 20.3536, lng: 85.8195 }
/** ~1 metre in degrees of latitude, for readable fixtures. */
const M = 1 / 111_320

const NOW = new Date('2026-08-21T20:00:00.000Z')

const report = (overrides: Partial<IncomingReport> = {}): IncomingReport => ({
  category: 'fire',
  title: 'Smoke in Block C stairwell',
  description: 'Smoke on the third floor landing of the east stairwell',
  location: { ...CENTRE },
  at: NOW,
  ...overrides,
})

const incident = (overrides: Partial<Incident> = {}): Incident =>
  ({
    id: 'inc-1',
    category: 'fire' as IncidentCategory,
    status: 'reported' as IncidentStatus,
    title: 'Smoke in Block C stairwell',
    description: 'Smoke on the third floor landing of the east stairwell',
    location: { ...CENTRE, label: 'Block C', method: 'floor-plan', confidence: 0.99 },
    createdAt: NOW.toISOString(),
    reportCount: 1,
    ...overrides,
  }) as Incident

describe('tokenize', () => {
  it('keeps content words and drops noise', () => {
    expect([...tokenize('Smoke in the Block C stairwell')]).toEqual([
      'smoke',
      'block',
      'c',
      'stairwell',
    ])
  })

  it('is case- and punctuation-insensitive', () => {
    expect(tokenize('SMOKE, block-C!')).toEqual(tokenize('smoke block c'))
  })
})

describe('jaccardSimilarity', () => {
  it('is 1 for identical sets and 0 for disjoint ones', () => {
    expect(jaccardSimilarity(tokenize('smoke block'), tokenize('smoke block'))).toBe(1)
    expect(jaccardSimilarity(tokenize('smoke'), tokenize('flooding'))).toBe(0)
  })

  it('treats an empty description as no evidence, not agreement', () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(0)
  })
})

describe('scoreMatch — the hard vetoes', () => {
  it('never fuses into a resolved incident', () => {
    expect(scoreMatch(report(), incident({ status: 'resolved' }), NOW)).toBeNull()
  })

  it('never fuses across categories', () => {
    // A fire and a medical call ten metres apart are two emergencies.
    expect(scoreMatch(report(), incident({ category: 'medical' }), NOW)).toBeNull()
  })

  it('never fuses beyond the distance ceiling', () => {
    const faraway = incident({
      location: {
        lat: CENTRE.lat + (MAX_FUSE_DISTANCE_M + 40) * M,
        lng: CENTRE.lng,
        label: 'x',
        method: 'gps',
        confidence: 0.4,
      },
    })
    expect(scoreMatch(report(), faraway, NOW)).toBeNull()
  })

  it('never fuses beyond the time window', () => {
    const stale = incident({
      createdAt: new Date(NOW.getTime() - FUSE_WINDOW_MS - 60_000).toISOString(),
    })
    expect(scoreMatch(report(), stale, NOW)).toBeNull()
  })
})

describe('scoreMatch — scoring', () => {
  it('scores an identical report at the same spot near the top', () => {
    const score = scoreMatch(report(), incident(), NOW)
    expect(score?.combined).toBeGreaterThan(0.9)
  })

  it('decays with distance', () => {
    const near = scoreMatch(report(), incident(), NOW)!.combined
    const far = scoreMatch(
      report(),
      incident({
        location: { lat: CENTRE.lat + 90 * M, lng: CENTRE.lng, label: 'x', method: 'gps', confidence: 0.4 },
      }),
      NOW,
    )!.combined
    expect(far).toBeLessThan(near)
  })

  it('decays with elapsed time', () => {
    const fresh = scoreMatch(report(), incident(), NOW)!.combined
    const older = scoreMatch(
      report(),
      incident({ createdAt: new Date(NOW.getTime() - 20 * 60_000).toISOString() }),
      NOW,
    )!.combined
    expect(older).toBeLessThan(fresh)
  })

  it('explains itself in terms a dispatcher can check', () => {
    const score = scoreMatch(report(), incident(), NOW)
    expect(score?.rationale).toMatch(/\d+m away/)
    expect(score?.rationale).toMatch(/wording overlap/)
  })
})

describe('findFusionCandidate', () => {
  it('fuses a second report of the same fire', () => {
    const second = report({ title: 'Smoke near Block C', description: 'Smoke in the stairwell' })
    expect(findFusionCandidate(second, [incident()], NOW)?.incident.id).toBe('inc-1')
  })

  it('opens a new incident for an unrelated emergency nearby', () => {
    const unrelated = report({
      category: 'medical',
      title: 'Student collapsed',
      description: 'Someone fainted by the entrance',
    })
    expect(findFusionCandidate(unrelated, [incident()], NOW)).toBeNull()
  })

  it('picks the single best candidate, never several', () => {
    const weaker = incident({
      id: 'inc-far',
      location: { lat: CENTRE.lat + 100 * M, lng: CENTRE.lng, label: 'x', method: 'gps', confidence: 0.4 },
    })
    const match = findFusionCandidate(report(), [weaker, incident()], NOW)
    expect(match?.incident.id).toBe('inc-1')
  })

  it('returns null against an empty board', () => {
    expect(findFusionCandidate(report(), [], NOW)).toBeNull()
  })

  it('does not fuse two vague reports that merely share a location', () => {
    // Conservative by design: fusing two different emergencies is worse than
    // showing a dispatcher two rows they can merge by eye.
    const vague = report({ title: 'Problem', description: '' })
    const otherVague = incident({ title: 'Issue', description: '' })
    expect(findFusionCandidate(vague, [otherVague], NOW)).toBeNull()
  })
})
