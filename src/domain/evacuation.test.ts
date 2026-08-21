import { describe, expect, it } from 'vitest'
import type { SafeZone } from '@/data/safe-zones'
import { compassDirection, formatNameList, planEvacuation, warrantsEvacuation } from './evacuation'
import type { Incident } from './types'

const CENTRE = { lat: 20.3536, lng: 85.8195 }

/** ~1 metre in degrees of latitude, for building test fixtures readably. */
const M = 1 / 111_320

const zoneAt = (id: string, northMetres: number, eastMetres: number): SafeZone => ({
  id,
  name: id,
  lat: CENTRE.lat + northMetres * M,
  lng: CENTRE.lng + eastMetres * M,
  capacity: 500,
  landmark: `the ${id}`,
})

describe('planEvacuation', () => {
  it('refuses a muster point sitting on top of the hazard, even when it is nearest', () => {
    const onTopOfFire = zoneAt('trap', 10, 0)
    const farButSafe = zoneAt('safe', 600, 0)

    const plan = planEvacuation(CENTRE, CENTRE, [onTopOfFire, farButSafe])

    // The whole point of the module: proximity must never beat safety.
    expect(plan?.zone.id).toBe('safe')
  })

  it('picks the closest zone to the person once unsafe ones are excluded', () => {
    const near = zoneAt('near', 300, 0)
    const far = zoneAt('far', 900, 0)
    const person = { lat: CENTRE.lat + 250 * M, lng: CENTRE.lng }

    expect(planEvacuation(CENTRE, person, [far, near])?.zone.id).toBe('near')
  })

  it('returns null rather than a bad recommendation when every zone is compromised', () => {
    const plan = planEvacuation(CENTRE, CENTRE, [zoneAt('a', 10, 0), zoneAt('b', 0, 20)])
    expect(plan).toBeNull()
  })

  it('reports distance and a walking estimate that agree with each other', () => {
    const plan = planEvacuation(CENTRE, CENTRE, [zoneAt('north', 500, 0)])

    expect(plan?.distanceM).toBeGreaterThan(450)
    expect(plan?.distanceM).toBeLessThan(550)
    expect(plan?.walkMinutes).toBe(5)
  })

  it('always offers at least one minute, never a zero-minute walk', () => {
    const plan = planEvacuation(CENTRE, CENTRE, [zoneAt('close-but-legal', 130, 0)])
    expect(plan?.walkMinutes).toBeGreaterThanOrEqual(1)
  })

  it('produces an instruction that can be broadcast verbatim', () => {
    const plan = planEvacuation(CENTRE, CENTRE, [zoneAt('Main Ground', 500, 0)])

    expect(plan?.instruction).toContain('Evacuate north')
    expect(plan?.instruction).toContain('Main Ground')
    expect(plan?.instruction).toMatch(/\.$/)
  })
})

describe('compassDirection', () => {
  it('names the four cardinals correctly', () => {
    expect(compassDirection(CENTRE, { lat: CENTRE.lat + 0.01, lng: CENTRE.lng })).toBe('north')
    expect(compassDirection(CENTRE, { lat: CENTRE.lat - 0.01, lng: CENTRE.lng })).toBe('south')
    expect(compassDirection(CENTRE, { lat: CENTRE.lat, lng: CENTRE.lng + 0.01 })).toBe('east')
    expect(compassDirection(CENTRE, { lat: CENTRE.lat, lng: CENTRE.lng - 0.01 })).toBe('west')
  })

  it('names diagonals', () => {
    expect(compassDirection(CENTRE, { lat: CENTRE.lat + 0.01, lng: CENTRE.lng + 0.01 })).toBe(
      'north-east',
    )
  })
})

describe('formatNameList', () => {
  it('reads as a spoken sentence', () => {
    expect(formatNameList(['Block B', 'Block C', 'Block D'])).toBe('Block B, Block C and Block D')
    expect(formatNameList(['Block B', 'Block C'])).toBe('Block B and Block C')
    expect(formatNameList(['Block B'])).toBe('Block B')
    expect(formatNameList([])).toBe('')
  })
})

describe('warrantsEvacuation', () => {
  const incident = (severity: Incident['severity'], status: Incident['status']) =>
    ({ severity, status }) as Incident

  it('moves people for life-threatening and urgent incidents', () => {
    expect(warrantsEvacuation(incident('P0', 'dispatched'))).toBe(true)
    expect(warrantsEvacuation(incident('P1', 'triaged'))).toBe(true)
  })

  it('does not evacuate a building over a water leak', () => {
    // Crying wolf on a P2 is how people learn to ignore the next real alarm.
    expect(warrantsEvacuation(incident('P2', 'dispatched'))).toBe(false)
    expect(warrantsEvacuation(incident('P3', 'reported'))).toBe(false)
  })

  it('stops advising evacuation once the incident is resolved', () => {
    expect(warrantsEvacuation(incident('P0', 'resolved'))).toBe(false)
  })
})
