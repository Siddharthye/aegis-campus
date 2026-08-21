import { CAMPUS25_BLOCKS, type Point } from '@/data/campus25'

/**
 * Turning campus coordinates into map coordinates, and deciding where names
 * can sit without landing on each other.
 *
 * All of it is pure: give it the same points and it returns the same numbers,
 * with no DOM, no canvas, and no measurement of rendered text. That is what
 * keeps it testable — and it is why this lives in the domain layer rather than
 * inside the component that draws the result.
 */

/** SVG user units across the map. Height follows from the campus aspect. */
const VIEW_WIDTH = 900

/** Breathing room around the framed points, as a fraction of their span. */
const PADDING = 0.04

/** Metres per degree of latitude — near enough anywhere on Earth. */
const METRES_PER_DEGREE = 111_320

export interface Projection {
  width: number
  height: number
  toXY(point: Point): { x: number; y: number }
  /** Metres per SVG unit — lets the scale bar be honest. */
  metresPerUnit: number
}

/**
 * An equirectangular projection fitted to the points it is given.
 *
 * Longitude is scaled by cos(latitude) so the campus keeps its true shape;
 * without that correction a plan at 20°N comes out visibly stretched. There
 * are no map tiles and no network calls here, which is the whole point — the
 * map has to draw itself with the wifi off.
 *
 * @example
 * const plan = project([...CAMPUS25_BOUNDARY])
 * plan.toXY({ lat: 20.3549, lng: 85.8197 }) // => { x, y } in SVG units
 */
export function project(points: readonly Point[], width = VIEW_WIDTH): Projection {
  const lats = points.map((point) => point.lat)
  const lngs = points.map((point) => point.lng)

  const latSpanRaw = Math.max(...lats) - Math.min(...lats)
  const lngSpanRaw = Math.max(...lngs) - Math.min(...lngs)
  const minLat = Math.min(...lats) - latSpanRaw * PADDING
  const maxLat = Math.max(...lats) + latSpanRaw * PADDING
  const minLng = Math.min(...lngs) - lngSpanRaw * PADDING
  const maxLng = Math.max(...lngs) + lngSpanRaw * PADDING

  const cosLat = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
  const lngSpan = (maxLng - minLng) * cosLat
  const latSpan = maxLat - minLat
  const height = Math.round(width * (latSpan / lngSpan))

  return {
    width,
    height,
    metresPerUnit: (lngSpan * METRES_PER_DEGREE) / width,
    toXY: (point) => ({
      x: ((point.lng - minLng) * cosLat * width) / lngSpan,
      y: ((maxLat - point.lat) * height) / latSpan,
    }),
  }
}

/* ── Block label layout ──────────────────────────────────────────────────
   Half these buildings are narrower than their own names, so a label centred
   on the footprint spills out over its neighbours — which is what made the
   map look hand-drawn. A name that does not fit inside its building is moved
   beneath it instead, and any two labels that still collide are pushed apart
   vertically. The font is monospace, so the width of a name is simply its
   length, which is the one thing that makes this measurable without
   rendering anything. */

const LABEL_FONT_SIZE = 10.5

/** JetBrains Mono advance width, as a fraction of the font size. */
const LABEL_CHAR_RATIO = 0.6

const LABEL_LINE_HEIGHT = 13.5

/** Breathing room required inside a block for its name to sit there. */
const LABEL_INSET = 8

export interface PlacedLabel {
  id: string
  name: string
  x: number
  y: number
}

/**
 * Where each block's name should be drawn.
 *
 * Names that fit sit inside their building; names that do not drop beneath
 * it, then slide further down past anything already there. Blocks are laid
 * out in a fixed order, so the result is deterministic — the same campus
 * always produces the same label positions.
 */
export function placeBlockLabels(plan: Projection): PlacedLabel[] {
  const placed: PlacedLabel[] = []

  for (const item of CAMPUS25_BLOCKS) {
    const topLeft = plan.toXY(item.footprint[0])
    const bottomRight = plan.toXY(item.footprint[2])
    const width = Math.abs(bottomRight.x - topLeft.x)
    const textWidth = measureLabel(item.name)

    const centreX = (topLeft.x + bottomRight.x) / 2
    const fitsInside = textWidth + LABEL_INSET <= width

    let y = fitsInside
      ? (topLeft.y + bottomRight.y) / 2 + LABEL_FONT_SIZE / 3
      : Math.max(topLeft.y, bottomRight.y) + LABEL_LINE_HEIGHT

    for (const other of placed) {
      const apart = Math.abs(other.x - centreX)
      const overlapWidth = (textWidth + measureLabel(other.name)) / 2
      const sameRow = Math.abs(other.y - y) < LABEL_LINE_HEIGHT
      if (apart < overlapWidth && sameRow) y = other.y + LABEL_LINE_HEIGHT
    }

    placed.push({ id: item.id, name: item.name, x: centreX, y })
  }

  return placed
}

/** Width of a label in SVG units. Monospace makes this arithmetic. */
function measureLabel(name: string): number {
  return name.length * LABEL_FONT_SIZE * LABEL_CHAR_RATIO
}

/** Where a name for an area belongs: the average of its corners. */
export function centroid(points: readonly Point[], plan: Projection) {
  const projected = points.map((point) => plan.toXY(point))
  return {
    x: projected.reduce((sum, point) => sum + point.x, 0) / projected.length,
    y: projected.reduce((sum, point) => sum + point.y, 0) / projected.length,
  }
}

/** Points as an SVG `points` attribute, rounded to keep the markup small. */
export function line(points: readonly Point[], plan: Projection): string {
  return points
    .map((point) => {
      const { x, y } = plan.toXY(point)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
