import { describe, expect, it } from 'vitest'
import {
  buildAnchors,
  listBuildings,
  locationFromAnchor,
  locationFromGps,
  locationFromMapTap,
  nearestBuilding,
  METHOD_CONFIDENCE,
} from './beacon'

describe('the anchor registry', () => {
  it('is derived deterministically, so printed sheets can never drift', () => {
    const first = buildAnchors()
    const second = buildAnchors()
    expect(first.map((anchor) => anchor.id)).toEqual(second.map((anchor) => anchor.id))
  })

  it('gives every floor of every building a stairwell and a corridor anchor', () => {
    const expected = listBuildings().reduce((sum, building) => sum + building.floors * 2, 0)
    expect(buildAnchors()).toHaveLength(expected)
  })

  it('issues unique, human-readable codes', () => {
    const ids = buildAnchors().map((anchor) => anchor.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('BLK-C-F3-A1')
  })

  it('abbreviates building names predictably', () => {
    const anchor = buildAnchors().find((item) => item.id === 'BLK-C-F3-A1')
    expect(anchor?.label).toBe('Block C · Floor 3 · Stairwell')
    expect(buildAnchors().some((item) => item.id.startsWith('HST-8-'))).toBe(true)
  })
})

describe('the location confidence ladder', () => {
  it('ranks methods honestly: QR beats a map tap beats GPS', () => {
    expect(METHOD_CONFIDENCE['qr-anchor']).toBeGreaterThan(METHOD_CONFIDENCE['map-tap'])
    expect(METHOD_CONFIDENCE['map-tap']).toBeGreaterThan(METHOD_CONFIDENCE.gps)
  })

  it('resolves a floor from a QR anchor', () => {
    const anchor = buildAnchors().find((item) => item.id === 'BLK-C-F3-A1')!
    const position = locationFromAnchor(anchor)

    expect(position.method).toBe('qr-anchor')
    expect(position.confidence).toBe(0.99)
    expect(position.floor).toBe(3)
    expect(position.buildingId).toBe('block-c')
  })

  it('admits that GPS has no idea what floor you are on', () => {
    const position = locationFromGps(20.3536, 85.8195)

    expect(position.method).toBe('gps')
    expect(position.confidence).toBe(0.4)
    // The honesty that the whole module exists to preserve.
    expect(position.floor).toBeUndefined()
    expect(position.label).toContain('±')
  })

  it('treats a map tap as building-level, not room-level', () => {
    const position = locationFromMapTap(20.3536, 85.8195)

    expect(position.method).toBe('map-tap')
    expect(position.confidence).toBe(0.7)
    expect(position.floor).toBeUndefined()
  })
})

describe('nearestBuilding', () => {
  it('finds the building a point sits on and reports the distance', () => {
    const target = listBuildings()[0]
    const result = nearestBuilding(target.centre.lat, target.centre.lng)

    expect(result.building.id).toBe(target.id)
    expect(result.distanceM).toBe(0)
  })

  it('still returns a nearest building for a point off campus', () => {
    const result = nearestBuilding(20.4, 85.9)
    expect(result.building).toBeDefined()
    expect(result.distanceM).toBeGreaterThan(0)
  })
})
