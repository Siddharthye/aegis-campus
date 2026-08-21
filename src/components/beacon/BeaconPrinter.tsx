'use client'

import { useEffect, useState } from 'react'
import type { BeaconAnchor } from '@/domain/beacon'
import { AnchorSheet } from './AnchorSheet'

interface AnchorBuilding {
  id: string
  name: string
}

/**
 * The BEACON admin surface: pick a building, print its anchor sheets, tape
 * them to the stairwells. One building at a time because that is how a
 * facilities team actually works through a campus.
 */
export function BeaconPrinter({ buildings }: { buildings: AnchorBuilding[] }) {
  const [buildingId, setBuildingId] = useState(buildings[0]?.id ?? '')
  const [anchors, setAnchors] = useState<BeaconAnchor[]>([])
  const [origin, setOrigin] = useState('')

  // Read from the browser rather than an env var so printed codes always point
  // at whatever host this page was actually served from.
  useEffect(() => setOrigin(window.location.origin), [])

  useEffect(() => {
    if (!buildingId) return

    void fetch(`/api/beacon/anchors?buildingId=${encodeURIComponent(buildingId)}`)
      .then((response) => response.json() as Promise<{ anchors: BeaconAnchor[] }>)
      .then((body) => setAnchors(body.anchors))
      .catch(() => setAnchors([]))
  }, [buildingId])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {buildings.map((building) => (
          <button
            key={building.id}
            type="button"
            onClick={() => setBuildingId(building.id)}
            className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
              building.id === buildingId
                ? 'bg-ops-accent/15 text-ops-accent'
                : 'text-ops-muted hover:bg-ops-panel hover:text-ops-text'
            }`}
          >
            {building.name}
          </button>
        ))}

        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto rounded-md border border-ops-accent/40 bg-ops-accent/10 px-3 py-1.5 text-[12px] font-medium text-ops-accent transition-colors hover:bg-ops-accent/20"
        >
          Print {anchors.length} sheets
        </button>
      </div>

      <AnchorSheet anchors={anchors} origin={origin} />
    </div>
  )
}
