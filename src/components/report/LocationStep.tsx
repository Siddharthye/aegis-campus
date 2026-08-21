'use client'

import { useEffect, useState } from 'react'
import type { BeaconAnchor } from '@/domain/beacon'
import { locationFromAnchor, locationFromGps, locationFromMapTap } from '@/domain/beacon'
import type { LocatedPosition } from '@/domain/types'
import { CampusPlan } from './CampusPlan'

interface LocationStepProps {
  location: LocatedPosition | null
  onChange: (location: LocatedPosition) => void
}

/**
 * Step 2 — where the incident is, and how sure we are.
 *
 * BEACON in practice: a scanned QR anchor resolves to a building, floor and
 * spot at 99%; a map tap knows the building at 70%; raw GPS knows a vicinity
 * at 40% and has no idea what floor you are on. The confidence is shown rather
 * than hidden, because a dispatcher makes better decisions when the system
 * admits what it does not know.
 */
export function LocationStep({ location, onChange }: LocationStepProps) {
  const [anchors, setAnchors] = useState<BeaconAnchor[]>([])
  const [anchorQuery, setAnchorQuery] = useState('')
  const [gpsState, setGpsState] = useState<'idle' | 'locating' | 'denied'>('idle')

  useEffect(() => {
    void fetch('/api/beacon/anchors')
      .then((response) => response.json() as Promise<{ anchors: BeaconAnchor[] }>)
      .then((body) => setAnchors(body.anchors))
      .catch(() => {
        // Anchors unavailable — map tap and GPS still work.
      })
  }, [])

  const matches = anchorQuery.trim().length === 0
    ? []
    : anchors
        .filter((anchor) =>
          `${anchor.id} ${anchor.label}`.toLowerCase().includes(anchorQuery.trim().toLowerCase()),
        )
        .slice(0, 6)

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
      <section className="rounded-lg border border-ops-border bg-ops-panel p-3">
        <label htmlFor="anchor-search" className="ops-label text-ops-accent">
          Scan or enter a QR anchor — 99% precise
        </label>
        <input
          id="anchor-search"
          value={anchorQuery}
          onChange={(event) => setAnchorQuery(event.target.value)}
          placeholder="BLK-C-F3-A1"
          className="mt-1.5 w-full rounded-md border border-ops-border bg-ops-bg px-2.5 py-2 font-mono text-[13px] uppercase text-ops-text placeholder:text-ops-faint focus:border-ops-accent/50 focus:outline-none"
        />

        {matches.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-1">
            {matches.map((anchor) => (
              <li key={anchor.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(locationFromAnchor(anchor))
                    setAnchorQuery('')
                  }}
                  className="w-full rounded-md border border-ops-border bg-ops-bg px-2.5 py-2 text-left transition-colors hover:border-ops-accent/40 hover:bg-ops-lift"
                >
                  <p className="font-mono text-[11px] text-ops-accent">{anchor.id}</p>
                  <p className="text-[12px] text-ops-text">{anchor.label}</p>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-1.5 text-[11px] text-ops-faint">
          Anchors are printed sheets taped to stairwells and corridors. Scanning one is the only
          way to resolve a floor — GPS cannot.
        </p>
      </section>

      <div className="flex flex-col gap-1.5">
        <p className="ops-label text-ops-muted">Or tap the plan — 70%</p>
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
          GPS unavailable. Use a QR anchor or tap the plan.
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
