import type { Coordinates, Incident, IncidentCategory, Responder, ResponderUnit } from './types'

const EARTH_RADIUS_M = 6_371_000
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

/** Great-circle distance between two points, in metres. */
export function distanceInMetres(from: Coordinates, to: Coordinates): number {
  const deltaLat = toRadians(to.lat - from.lat)
  const deltaLng = toRadians(to.lng - from.lng)
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(haversine))
}

/** Which responder unit handles which category of emergency. */
const UNIT_FOR_CATEGORY: Record<IncidentCategory, ResponderUnit> = {
  fire: 'fire',
  medical: 'medical',
  harassment: 'security',
  security: 'security',
  infrastructure: 'maintenance',
  other: 'security',
}

/** Average brisk walking speed used for ETA estimates. */
const WALKING_METRES_PER_MIN = 85

export interface ArrivalEstimate {
  distanceM: number
  etaMinutes: number
}

/**
 * How far a responder still has to travel, and how long it should take.
 *
 * Separated from {@link recommendResponders} because it is also the *live*
 * calculation: once a responder is dispatched and streaming position, the
 * control room recomputes this on every movement, so the ETA on screen decays
 * toward zero instead of being frozen at the moment of assignment.
 *
 * @example
 * estimateArrival({ lat: 20.3536, lng: 85.8195 }, incident.location)
 * // => { distanceM: 210, etaMinutes: 3 }
 */
export function estimateArrival(from: Coordinates, to: Coordinates): ArrivalEstimate {
  const distanceM = Math.round(distanceInMetres(from, to))
  return { distanceM, etaMinutes: Math.max(1, Math.round(distanceM / WALKING_METRES_PER_MIN)) }
}

export interface DispatchRecommendation {
  responder: Responder
  distanceM: number
  etaMinutes: number
  /** Why this responder — shown in the control room and defensible in Q&A. */
  reason: string
}

/**
 * Ranks available responders for an incident: right unit first, then nearest.
 * Falls back to any available responder when the matching unit is exhausted —
 * a security guard at the scene beats a perfect unit that never arrives.
 *
 * @example
 * recommendResponders(incident, responders)[0]
 * // => { responder, distanceM: 210, etaMinutes: 3, reason: "Nearest available medical unit — 210m away" }
 */
export function recommendResponders(
  incident: Incident,
  responders: readonly Responder[],
): DispatchRecommendation[] {
  const preferredUnit = UNIT_FOR_CATEGORY[incident.category]
  const available = responders.filter((responder) => responder.status === 'available')

  const ranked = [...available].sort((a, b) => {
    const unitGap = Number(b.unit === preferredUnit) - Number(a.unit === preferredUnit)
    if (unitGap !== 0) return unitGap
    return (
      distanceInMetres(a.location, incident.location) - distanceInMetres(b.location, incident.location)
    )
  })

  return ranked.map((responder) => {
    const { distanceM, etaMinutes } = estimateArrival(responder.location, incident.location)
    const unitNote = responder.unit === preferredUnit ? `Nearest available ${responder.unit} unit` : `Fallback (${responder.unit}) — no ${preferredUnit} unit free`

    return { responder, distanceM, etaMinutes, reason: `${unitNote} — ${distanceM}m away` }
  })
}
