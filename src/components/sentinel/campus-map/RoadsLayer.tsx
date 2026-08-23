import { CAMPUS25_BOUNDARY, CAMPUS25_RING_ROAD } from '@/data/campus25'
import { line } from '@/domain/campus-projection'
import type { LayerProps } from './types'

/**
 * The ring road and the edge of campus.
 *
 * The road is drawn twice — a dark casing, then the surface on top — because
 * that is how a road reads on a map: the casing is what separates it from the
 * ground rather than an outline anyone consciously sees.
 */
export function RoadsLayer({ plan }: LayerProps) {
  const road = line(CAMPUS25_RING_ROAD, plan)

  return (
    <>
      <polyline
        points={road}
        fill="none"
        stroke="#0a0e17"
        strokeWidth={11}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={road}
        fill="none"
        stroke="#2b3444"
        strokeWidth={7}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dashed, because a campus boundary is a fact about jurisdiction
          rather than a wall anyone walks into. */}
      <polygon
        points={line(CAMPUS25_BOUNDARY, plan)}
        fill="#a78bfa"
        fillOpacity={0.035}
        stroke="#a78bfa"
        strokeOpacity={0.3}
        strokeWidth={1.4}
        strokeDasharray="8 6"
      />
    </>
  )
}
