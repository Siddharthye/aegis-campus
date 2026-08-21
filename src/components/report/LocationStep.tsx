'use client'

import { useState } from 'react'
import { locationFromGps, locationFromMapTap } from '@/domain/campus-geometry'
import type { LocatedPosition } from '@/domain/types'
import { CampusPlan } from './CampusPlan'

interface LocationStepProps {
  location: LocatedPosition | null
  onChange: (location: LocatedPosition) => void
}

/**
 * Step 2 — where the incident is, and how sure we are.
 *
 * Three honest methods, in descending precision: a room picked on the floor
 * plan (85%, carries a floor), a tap on the campus map (70%, building only),
 * and raw GPS (40%, a vicinity with no floor at all). The confidence is shown
 * rather than hidden, because a dispatcher makes better decisions when the
 * system admits what it does not know.
 *
 * There is no code to scan. Anyone who can reach for a printed sticker can
 * reach for the map, and someone who cannot reach for either needs SENTINEL,
 * not a better address field.
 */
export function LocationStep({ location, onChange }: LocationStepProps) {
  const [gpsState, setGpsState] = useState<'idle' | 'locating' | 'denied'>('idle')

  const useGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsState('denied')
      return
    }

    setGpsState('locating')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange(locationFromGps(position.coords.latitude, position.coords.longitude))
        setGpsState('idle')
      },
      () => setGpsState('denied'),
      { enableHighAccuracy: true, timeout: 8_000 },
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-ops-accent/30 bg-ops-accent/5 p-3">
        <p className="ops-label text-ops-accent">Most precise · pick a room</p>
        <p className="mt-1 text-[11px] leading-relaxed text-ops-muted">
          Tap your room on the floor plan beside this form. That resolves a building, a floor and
          a room — the only thing GPS can never give you.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="ops-label text-ops-muted">Or tap the campus map — 70%</p>
        <CampusPlan
          marker={location}
          onPick={(point) => onChange(locationFromMapTap(point.lat, point.lng))}
        />
      </div>

      <button
        type="button"
        onClick={useGps}
        disabled={gpsState === 'locating'}
        className="rounded-md border border-ops-border bg-ops-panel px-3 py-2 text-[12px] text-ops-muted transition-colors hover:border-ops-accent/30 hover:text-ops-text disabled:opacity-50"
      >
        {gpsState === 'locating' ? 'Locating…' : 'Use GPS instead — 40%, no floor'}
      </button>
      {gpsState === 'denied' && (
        <p className="text-[11px] text-sev-p1">
          GPS unavailable. Pick a room on the floor plan or tap the campus map.
        </p>
      )}

      {location && (
        <div className="rounded-lg border border-ops-accent/40 bg-ops-accent/5 p-3">
          <p className="ops-label text-ops-accent">Selected</p>
          <p className="mt-1 text-[13px] text-ops-text">{location.label}</p>
          <p className="mt-0.5 font-mono text-[11px] text-ops-muted">
            {Math.round(location.confidence * 100)}% confidence · {location.method}
            {location.floor !== undefined && ` · floor ${location.floor}`}
          </p>
        </div>
      )}
    </div>
  )
}
