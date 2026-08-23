'use client'

import { useMemo, useState } from 'react'
import {
  CAMPUS25_BLOCKS,
  CAMPUS25_BOUNDARY,
  CAMPUS25_GATES,
  CAMPUS25_RING_ROAD,
  CAMPUS25_TERRAIN,
} from '@/data/campus25'
import { project } from '@/domain/campus-projection'
import type { RiskPattern, RouteRisk } from '@/domain/risk-map'
import type { SafeWalk } from '@/domain/safe-walk'
import { MapViewport } from '@/components/ui/MapViewport'
import { BlocksLayer } from './campus-map/BlocksLayer'
import { GatesLayer } from './campus-map/GatesLayer'
import { GroundLayer } from './campus-map/GroundLayer'
import { LandmarksLayer } from './campus-map/LandmarksLayer'
import { MapDefs } from './campus-map/MapDefs'
import { MapInspector } from './campus-map/MapInspector'
import { MapLegend } from './campus-map/MapLegend'
import { MusterLayer } from './campus-map/MusterLayer'
import { RiskLayer } from './campus-map/RiskLayer'
import { RoadsLayer } from './campus-map/RoadsLayer'
import { RoutesLayer } from './campus-map/RoutesLayer'
import { ScaleBar } from './campus-map/ScaleBar'
import { WalksLayer } from './campus-map/WalksLayer'
import type { Focus } from './campus-map/types'

/**
 * Campus 25 — the map Safe Walk is built around.
 *
 * Drawn from real coordinates with an equirectangular projection, which is
 * exact enough across 500 metres and needs no tiles, no key and no network.
 *
 * This file is the paint order and nothing else. Each layer lives in
 * `campus-map/` and says in its own docstring why it sits where it does; read
 * top to bottom, the JSX below is the order someone reads a map under stress —
 * ground and water first, then roads, then buildings, then the things that
 * carry meaning: risk, routes, gates, musters, and finally the people
 * currently walking. Moving a line here changes what covers what, which is
 * why the order is the one thing kept in a single place.
 */

interface Campus25MapProps {
  walks: readonly SafeWalk[]
  /** SIGHTLINE patterns to shade. Empty until the risk snapshot loads. */
  patterns?: readonly RiskPattern[]
  /** Ranked routes; the safest is drawn emphasised. */
  routes?: readonly RouteRisk[]
  /** Called when a block or gate is clicked. Omit to leave the map read-only. */
  onPickDestination?: (destination: string) => void
}

export function Campus25Map({
  walks,
  patterns = [],
  routes = [],
  onPickDestination,
}: Campus25MapProps) {
  const [focus, setFocus] = useState<Focus | null>(null)

  /* Framed once from every feature that must fit on screen, so adding a
     building cannot silently push an existing one out of frame. */
  const plan = useMemo(
    () =>
      project([
        ...CAMPUS25_BOUNDARY,
        ...CAMPUS25_BLOCKS.flatMap((item) => item.footprint),
        ...CAMPUS25_GATES.map((gate) => gate.position),
        ...CAMPUS25_RING_ROAD,
        ...CAMPUS25_TERRAIN.flatMap((item) => item.outline),
      ]),
    [],
  )

  /** Every hoverable feature reports through here, so only one can be active. */
  const describe = (next: Focus | null) => () => setFocus(next)
  const interactive = { plan, focus, describe }

  return (
    <div className="flex flex-col gap-2.5">
      <MapViewport label="Campus 25 · Patia" className="h-[440px] sm:h-[560px]">
        <svg
          viewBox={`0 0 ${plan.width} ${plan.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Campus 25: pond, ring road, blocks, gates, walking routes with reported-risk shading, muster points and live safe walks"
          className="size-full"
        >
          <MapDefs />

          <GroundLayer plan={plan} />
          <RoadsLayer plan={plan} />
          <RiskLayer plan={plan} patterns={patterns} describe={describe} />
          <RoutesLayer {...interactive} routes={routes} />
          <BlocksLayer {...interactive} onPick={onPickDestination} />
          <LandmarksLayer plan={plan} />
          <MusterLayer plan={plan} />
          <GatesLayer {...interactive} onPick={onPickDestination} />
          <WalksLayer plan={plan} walks={walks} />
          <ScaleBar plan={plan} />
        </svg>
      </MapViewport>

      <MapInspector focus={focus} pickable={onPickDestination !== undefined} />
      <MapLegend showRisk={patterns.length > 0} />
    </div>
  )
}
