import { describe, expect, it } from 'vitest'
import { distanceInMetres, recommendResponders } from './dispatch'
import type { Incident, Responder, ResponderStatus, ResponderUnit } from './types'

const CENTRE = { lat: 20.3536, lng: 85.8195 }
const M = 1 / 111_320

const responder = (
  id: string,
  unit: ResponderUnit,
  northMetres: number,
  status: ResponderStatus = 'available',
): Responder => ({
  id,
  name: id,
  unit,
  status,
  location: { lat: CENTRE.lat + northMetres * M, lng: CENTRE.lng },
  incidentId: null,
})

const fire = { category: 'fire', location: { ...CENTRE } } as Incident

describe('distanceInMetres', () => {
  it('is zero for a point against itself', () => {
    expect(distanceInMetres(CENTRE, CENTRE)).toBe(0)
  })

  it('measures a known north-south offset', () => {
    expect(distanceInMetres(CENTRE, { lat: CENTRE.lat + 100 * M, lng: CENTRE.lng })).toBeCloseTo(
      100,
      0,
    )
  })

  it('is symmetric', () => {
    const other = { lat: 20.36, lng: 85.83 }
    expect(distanceInMetres(CENTRE, other)).toBeCloseTo(distanceInMetres(other, CENTRE), 6)
  })
})

describe('recommendResponders', () => {
  it('prefers the right unit for the category over a closer wrong one', () => {
    const ranked = recommendResponders(fire, [
      responder('security-next-door', 'security', 10),
      responder('fire-across-campus', 'fire', 400),
    ])
    expect(ranked[0].responder.id).toBe('fire-across-campus')
  })

  it('breaks ties within the right unit by distance', () => {
    const ranked = recommendResponders(fire, [
      responder('fire-far', 'fire', 500),
      responder('fire-near', 'fire', 50),
    ])
    expect(ranked.map((entry) => entry.responder.id)).toEqual(['fire-near', 'fire-far'])
  })

  it('falls back to anyone available when the matching unit is exhausted', () => {
    // A guard who arrives beats a perfect unit that never does.
    const ranked = recommendResponders(fire, [responder('security-1', 'security', 30)])
    expect(ranked).toHaveLength(1)
    expect(ranked[0].reason).toContain('no fire unit free')
  })

  it('never offers a responder who is already busy', () => {
    const ranked = recommendResponders(fire, [
      responder('busy', 'fire', 10, 'on-scene'),
      responder('free', 'fire', 300),
    ])
    expect(ranked.map((entry) => entry.responder.id)).toEqual(['free'])
  })

  it('returns nothing when every responder is committed', () => {
    expect(recommendResponders(fire, [responder('busy', 'fire', 10, 'assigned')])).toEqual([])
  })

  it('attaches an ETA of at least one minute and a stated reason', () => {
    const [best] = recommendResponders(fire, [responder('fire-1', 'fire', 5)])
    expect(best.etaMinutes).toBeGreaterThanOrEqual(1)
    expect(best.reason).toContain('Nearest available fire unit')
    expect(best.reason).toMatch(/\d+m away/)
  })

  it('routes each category to its owning unit', () => {
    const units: Array<[Incident['category'], ResponderUnit]> = [
      ['medical', 'medical'],
      ['harassment', 'security'],
      ['infrastructure', 'maintenance'],
    ]

    for (const [category, unit] of units) {
      const incident = { category, location: { ...CENTRE } } as Incident
      const ranked = recommendResponders(incident, [
        responder('other', 'fire', 10),
        responder('correct', unit, 300),
      ])
      expect(ranked[0].responder.id).toBe('correct')
    }
  })
})
