'use client'

import { useMemo } from 'react'
import { listBuildings } from '@/domain/campus-geometry'
import type { Coordinates } from '@/domain/types'
import { createPlanProjection, footprintPoints } from './plan-math'

/** Fill per building kind, so the plan reads at a glance without a legend. */
const KIND_FILL: Record<string, string> = {
  academic: 'fill-ops-lift',
  hostel: 'fill-ops-lift',
  public: 'fill-ops-panel',
  medical: 'fill-emerald-500/15',
  utility: 'fill-ops-panel',
  security: 'fill-ops-panel',
}

interface CampusPlanProps {
  /** Marker position, if a location has been chosen. */
  marker: Coordinates | null
  /** Called with the geographic point under a click. */
  onPick: (point: Coordinates) => void
}

/**
 * A tappable campus plan.
 *
 * Hand-drawn SVG over the shared footprint data rather than a tile map: it
 * needs no network, no API key and no map library, which is what lets the
 * report screen work in a basement with the wifi off — exactly where campus
 * emergencies happen.
 */
export function CampusPlan({ marker, onPick }: CampusPlanProps) {
  const buildings = useMemo(() => listBuildings(), [])
  const plan = useMemo(() => createPlanProjection(buildings), [buildings])

  const handleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * plan.width
    const y = ((event.clientY - bounds.top) / bounds.height) * plan.height
    onPick(plan.toCoordinates(x, y))
  }

  const markerXY = marker ? plan.toXY(marker) : null

  return (
    <svg
      viewBox={`0 0 ${plan.width} ${plan.height}`}
      onClick={handleClick}
      role="img"
      aria-label="Campus plan — tap to set the incident location"
      className="w-full cursor-crosshair rounded-lg border border-ops-border bg-ops-bg"
    >
      {buildings.map((building) => (
        <polygon
          key={building.id}
          points={footprintPoints(building, plan)}
          className={`${KIND_FILL[building.kind] ?? 'fill-ops-panel'} stroke-ops-border`}
          strokeWidth={0.5}
        />
      ))}

      {markerXY && (
        <g>
          <circle
            cx={markerXY.x}
            cy={markerXY.y}
            r={7}
            className="fill-ops-accent/25 stroke-ops-accent"
            strokeWidth={1}
          />
          <circle cx={markerXY.x} cy={markerXY.y} r={2.5} className="fill-ops-accent" />
        </g>
      )}
    </svg>
  )
}
