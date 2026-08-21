import { SAFE_ZONES, type SafeZone } from '@/data/safe-zones'
import { listBuildings } from './campus-geometry'
import { distanceInMetres } from './dispatch'
import type { Coordinates, Incident, Severity } from './types'

/**
 * Evacuation guidance — turning "where is the fire" into "where do I go".
 *
 * A map that shows a hazard tells people something they can already smell.
 * The decision they actually need is which way to walk, and the naive answer
 * (nearest assembly point) is sometimes the lethal one, because the nearest
 * point can be on the far side of the fire. So the rule here is: never route
 * anyone toward the hazard, then optimise for proximity.
 */

/** No muster point closer than this to a hazard is offered, ever. */
const MIN_SAFE_DISTANCE_M = 120

/** Buildings within this radius are named as "avoid" in the guidance. */
const AVOID_RADIUS_M = 90

/** Brisk evacuation pace — faster than the strolling figure dispatch uses. */
const EVACUATION_METRES_PER_MIN = 100

/** Severities that warrant telling people to leave the building at all. */
const EVACUATION_SEVERITIES: readonly Severity[] = ['P0', 'P1']

const COMPASS_POINTS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] as const

/**
 * Compass direction from one point to another, in words.
 *
 * People do not navigate by bearing in degrees while evacuating, and a phone
 * compass is unreliable indoors — but "head north-east toward the field" is
 * something a person can act on.
 *
 * @example
 * compassDirection({ lat: 20.35, lng: 85.81 }, { lat: 20.36, lng: 85.81 }) // => 'north'
 */
export function compassDirection(from: Coordinates, to: Coordinates): (typeof COMPASS_POINTS)[number] {
  const north = to.lat - from.lat
  const east = to.lng - from.lng
  // atan2(east, north) gives a compass bearing directly: 0 is north, growing clockwise.
  const bearing = (Math.atan2(east, north) * 180) / Math.PI
  const normalised = (bearing + 360) % 360
  return COMPASS_POINTS[Math.round(normalised / 45) % COMPASS_POINTS.length]
}

/**
 * Joins names the way a person speaks them: "A", "A and B", "A, B and C".
 *
 * This is broadcast copy read by thousands under stress, so it has to scan as
 * a sentence — "Block B and Block C and Block D" reads as a machine wrote it.
 *
 * @example
 * formatNameList(['Block B', 'Block C', 'Block D']) // => 'Block B, Block C and Block D'
 */
export function formatNameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export interface EvacuationPlan {
  zone: SafeZone
  distanceM: number
  walkMinutes: number
  direction: (typeof COMPASS_POINTS)[number]
  /** Buildings adjacent to the hazard, named so people route around them. */
  avoid: string[]
  /** One sentence, ready to drop into a SIREN broadcast verbatim. */
  instruction: string
}

/**
 * Where to send someone standing at `from`, given a hazard at `hazard`.
 *
 * Zones within {@link MIN_SAFE_DISTANCE_M} of the hazard are discarded before
 * anything else is considered, so proximity can never override safety. Among
 * the survivors the closest to the person wins. Returns null only when every
 * muster point is compromised, which is a real answer worth surfacing rather
 * than papering over with a bad recommendation.
 *
 * @example
 * planEvacuation({ lat: 20.3536, lng: 85.8189 }, { lat: 20.3536, lng: 85.8189 })?.zone.name
 * // => 'Main Ground'
 */
export function planEvacuation(
  hazard: Coordinates,
  from: Coordinates,
  zones: readonly SafeZone[] = SAFE_ZONES,
): EvacuationPlan | null {
  const safe = zones.filter((zone) => distanceInMetres(zone, hazard) >= MIN_SAFE_DISTANCE_M)
  if (safe.length === 0) return null

  const nearest = [...safe].sort(
    (a, b) => distanceInMetres(from, a) - distanceInMetres(from, b),
  )[0]

  const distanceM = Math.round(distanceInMetres(from, nearest))
  const direction = compassDirection(from, nearest)
  const avoid = listBuildings()
    .filter((building) => distanceInMetres(building.centre, hazard) <= AVOID_RADIUS_M)
    .map((building) => building.shortName)

  const avoidClause = avoid.length > 0 ? ` Avoid ${formatNameList(avoid)}.` : ''

  return {
    zone: nearest,
    distanceM,
    walkMinutes: Math.max(1, Math.round(distanceM / EVACUATION_METRES_PER_MIN)),
    direction,
    avoid,
    instruction:
      `Evacuate ${direction} to ${nearest.name} — ${nearest.landmark}, about ${distanceM}m.` +
      avoidClause,
  }
}

/**
 * Whether an incident is severe enough to move people at all.
 *
 * Evacuating for a P2 water leak trains people to ignore the next alarm, so
 * the threshold is deliberate rather than "any incident".
 *
 * @example
 * warrantsEvacuation({ severity: 'P0', status: 'dispatched' } as Incident) // => true
 */
export function warrantsEvacuation(incident: Pick<Incident, 'severity' | 'status'>): boolean {
  return EVACUATION_SEVERITIES.includes(incident.severity) && incident.status !== 'resolved'
}
