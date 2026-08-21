import { campusGeoJSON } from '@/data/campus'
import { distanceInMetres } from './dispatch'
import type { Coordinates, LocatedPosition } from './types'

/**
 * BEACON — indoor location, made honest. GPS cannot resolve a floor, so AEGIS
 * plants QR anchors: printed codes bound to a building + floor + spot. This
 * module derives the whole anchor registry deterministically from the campus
 * footprint data — no database, same registry on every machine.
 */

/** A campus building with its centroid and footprint ring (pure data). */
export interface CampusBuilding {
  id: string
  name: string
  /** Name without the descriptive suffix, e.g. "Block A — Academic" → "Block A". */
  shortName: string
  kind: string
  floors: number
  centre: Coordinates
  footprint: Coordinates[]
}

/** One printed QR anchor: a physical point that resolves to room-level truth. */
export interface BeaconAnchor {
  /** Printed code, e.g. "BLK-C-F3-A1" — also what the QR deep link carries. */
  id: string
  label: string
  buildingId: string
  buildingName: string
  floor: number
  spot: 'Stairwell' | 'Corridor'
  lat: number
  lng: number
}

/** Confidence per location method — shown honestly in the report UI. */
export const METHOD_CONFIDENCE = { 'qr-anchor': 0.99, 'map-tap': 0.7, gps: 0.4 } as const

const ABBREVIATIONS: Record<string, string> = { block: 'BLK', hostel: 'HST' }

/** "block-c" → "BLK-C", "hostel-8" → "HST-8", "library" → "LIB". */
const codeFor = (buildingId: string): string =>
  buildingId
    .split('-')
    .map((word) => (/^\d+$/.test(word) ? word : (ABBREVIATIONS[word] ?? word.slice(0, 3).toUpperCase())))
    .join('-')

const toBuilding = (feature: (typeof campusGeoJSON)['features'][number]): CampusBuilding => {
  const ring = feature.geometry.coordinates[0].slice(0, -1) // drop the closing vertex
  const footprint = ring.map(([lng, lat]) => ({ lat, lng }))
  const centre = {
    lat: footprint.reduce((sum, point) => sum + point.lat, 0) / footprint.length,
    lng: footprint.reduce((sum, point) => sum + point.lng, 0) / footprint.length,
  }
  const { id, name, kind, floors } = feature.properties
  return { id, name, shortName: name.split(' — ')[0], kind, floors, centre, footprint }
}

const BUILDINGS: readonly CampusBuilding[] = campusGeoJSON.features.map(toBuilding)

/**
 * Every campus building, derived once from the shared footprint GeoJSON.
 *
 * @example
 * listBuildings().find((b) => b.id === 'block-c')?.shortName // => "Block C"
 */
export function listBuildings(): readonly CampusBuilding[] {
  return BUILDINGS
}

const ANCHOR_SPOTS: readonly BeaconAnchor['spot'][] = ['Stairwell', 'Corridor']

const ANCHORS: readonly BeaconAnchor[] = BUILDINGS.flatMap((building) =>
  Array.from({ length: building.floors }, (_, index) => index + 1).flatMap((floor) =>
    ANCHOR_SPOTS.map((spot, spotIndex) => ({
      id: `${codeFor(building.id)}-F${floor}-A${spotIndex + 1}`,
      label: `${building.shortName} · Floor ${floor} · ${spot}`,
      buildingId: building.id,
      buildingName: building.shortName,
      floor,
      spot,
      lat: building.centre.lat,
      lng: building.centre.lng,
    })),
  ),
)

/**
 * The full deterministic anchor registry: two anchors (stairwell + corridor)
 * per floor, per building. Printing these sheets IS the BEACON deployment.
 *
 * @example
 * buildAnchors().find((a) => a.id === 'BLK-C-F3-A1')?.label
 * // => "Block C · Floor 3 · Stairwell"
 */
export function buildAnchors(): readonly BeaconAnchor[] {
  return ANCHORS
}

/**
 * The building whose centroid is closest to a point, with the distance —
 * the best label GPS or a map tap can honestly claim.
 *
 * @example
 * nearestBuilding(20.3536, 85.8195).building.shortName // => "Block D"
 */
export function nearestBuilding(lat: number, lng: number): { building: CampusBuilding; distanceM: number } {
  let best = BUILDINGS[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const building of BUILDINGS) {
    const distance = distanceInMetres({ lat, lng }, building.centre)
    if (distance < bestDistance) {
      best = building
      bestDistance = distance
    }
  }
  return { building: best, distanceM: Math.round(bestDistance) }
}

/**
 * A scanned QR anchor as an incident location: room-level, floor-aware, 99%.
 *
 * @example
 * locationFromAnchor(anchor).confidence // => 0.99
 */
export function locationFromAnchor(anchor: BeaconAnchor): LocatedPosition {
  return {
    lat: anchor.lat,
    lng: anchor.lng,
    label: anchor.label,
    method: 'qr-anchor',
    confidence: METHOD_CONFIDENCE['qr-anchor'],
    floor: anchor.floor,
    buildingId: anchor.buildingId,
  }
}

/**
 * A raw GPS fix as an incident location — vicinity only, no floor, 40%.
 *
 * @example
 * locationFromGps(20.3536, 85.8195).method // => "gps"
 */
export function locationFromGps(lat: number, lng: number): LocatedPosition {
  const { building, distanceM } = nearestBuilding(lat, lng)
  return {
    lat,
    lng,
    label: `Near ${building.shortName} (±${Math.max(25, distanceM)}m)`,
    method: 'gps',
    confidence: METHOD_CONFIDENCE.gps,
    buildingId: building.id,
  }
}

/**
 * A tap on the campus plan as an incident location — building-level, 70%.
 *
 * @example
 * locationFromMapTap(20.3536, 85.8195).confidence // => 0.7
 */
export function locationFromMapTap(lat: number, lng: number): LocatedPosition {
  const { building } = nearestBuilding(lat, lng)
  return {
    lat,
    lng,
    label: `${building.shortName} · Tapped on plan`,
    method: 'map-tap',
    confidence: METHOD_CONFIDENCE['map-tap'],
    buildingId: building.id,
  }
}
