import type { CampusBuilding } from '@/domain/campus-geometry'
import type { Coordinates } from '@/domain/types'

/**
 * Equirectangular projection between campus lat/lng and the SVG plan's local
 * coordinate space. Good to centimetres across a ~500m campus — a full map
 * projection library would be dead weight here.
 */
export interface PlanProjection {
  width: number
  height: number
  /** Geographic point → SVG user units (y grows downward). */
  toXY(point: Coordinates): { x: number; y: number }
  /** SVG user units → geographic point. Inverse of `toXY`. */
  toCoordinates(x: number, y: number): Coordinates
}

/** Padding around the outermost footprints, as a fraction of the span. */
const PADDING_RATIO = 0.06

/**
 * Builds the projection that frames every given footprint in a viewBox of the
 * requested width. Longitude is scaled by cos(latitude) so buildings keep
 * their true proportions instead of stretching east–west.
 *
 * @example
 * const plan = createPlanProjection(listBuildings(), 360)
 * plan.toCoordinates(plan.toXY({ lat: 20.3536, lng: 85.8195 }).x, 12).lng // ≈ 85.8195
 */
export function createPlanProjection(
  buildings: readonly CampusBuilding[],
  width = 360,
): PlanProjection {
  const points = buildings.flatMap((building) => building.footprint)
  const lats = points.map((point) => point.lat)
  const lngs = points.map((point) => point.lng)

  const latSpanRaw = Math.max(...lats) - Math.min(...lats)
  const lngSpanRaw = Math.max(...lngs) - Math.min(...lngs)
  const minLat = Math.min(...lats) - latSpanRaw * PADDING_RATIO
  const maxLat = Math.max(...lats) + latSpanRaw * PADDING_RATIO
  const minLng = Math.min(...lngs) - lngSpanRaw * PADDING_RATIO
  const maxLng = Math.max(...lngs) + lngSpanRaw * PADDING_RATIO

  const cosLat = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
  const lngSpan = (maxLng - minLng) * cosLat
  const latSpan = maxLat - minLat
  const height = Math.round(width * (latSpan / lngSpan))

  return {
    width,
    height,
    toXY: (point) => ({
      x: ((point.lng - minLng) * cosLat * width) / lngSpan,
      y: ((maxLat - point.lat) * height) / latSpan,
    }),
    toCoordinates: (x, y) => ({
      lat: maxLat - (y * latSpan) / height,
      lng: minLng + (x * lngSpan) / (width * cosLat),
    }),
  }
}

/**
 * A building footprint as an SVG `points` attribute string.
 *
 * @example
 * footprintPoints(building, plan) // => "12.3,45.6 78.9,45.1 …"
 */
export function footprintPoints(building: CampusBuilding, plan: PlanProjection): string {
  return building.footprint
    .map((point) => {
      const { x, y } = plan.toXY(point)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
