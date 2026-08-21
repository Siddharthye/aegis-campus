import { campusGeoJSON } from '@/data/campus'
import { distanceInMetres } from './dispatch'
import type { Coordinates, LocatedPosition } from './types'

/**
 * Campus geometry — the shared answer to "where is this?".
 *
 * Every position records how it was obtained and how far to trust it, because
 * pretending GPS works indoors is how campus safety products fail. Raw GPS is
 * a vicinity with no floor; a tap on the campus map names a building; a room
 * picked on the floor plan names a room *and* a floor.
 *
 * There is deliberately no printed-code scheme here. Asking someone who is
 * being followed to find and scan a sticker is a fantasy, and the interactive
 * floor plan already resolves a room with no physical infrastructure to print,
 * mount, replace or vandalise.
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

/**
 * Confidence per location method, shown honestly in the report UI.
 *
 * A room picked on the floor plan sits well above raw GPS because it carries a
 * floor, but below certainty: the reporter named the room, nothing verified
 * they are standing in it.
 */
export const METHOD_CONFIDENCE = { 'floor-plan': 0.85, 'map-tap': 0.7, gps: 0.4 } as const

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

/**
 * The building whose centroid is closest to a point, with the distance —
 * the best label GPS or a map tap can honestly claim.
 *
 * @example
 * nearestBuilding(20.3536, 85.8195).building.shortName // => "Block D"
 */
export function nearestBuilding(
  lat: number,
  lng: number,
): { building: CampusBuilding; distanceM: number } {
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
