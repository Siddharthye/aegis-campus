'use client'

import { useEffect, useMemo, useState } from 'react'
import type { BeaconAnchor } from '@/domain/beacon'
import { Chip, MiniBar, Panel, Stat } from '@/components/ui/Panel'
import { AnchorSheet } from './AnchorSheet'

/**
 * BEACON as a filterable registry, not a print queue.
 *
 * There are two anchors per floor per building — several hundred codes. A grid
 * of QR images is unusable at that size, so the primary surface is a filtered
 * list with a selected-anchor detail, and printing is one action within it.
 */

type StatusFilter = 'all' | 'deployed' | 'pending'

/**
 * Deployment state is derived from the anchor id rather than stored: the
 * registry is generated from campus geometry and has no database behind it.
 * A real rollout would replace this with a scan log — the shape of the UI
 * would not change, which is the point of deriving it here.
 */
function isDeployed(anchor: BeaconAnchor): boolean {
  return anchor.floor <= 3
}

/** Signal quality stands in for how reliably a printed code scans in situ. */
function signalFor(anchor: BeaconAnchor): number {
  return anchor.spot === 'Stairwell' ? 92 : 78
}

export function BeaconExplorer({ buildings }: { buildings: { id: string; name: string }[] }) {
  const [anchors, setAnchors] = useState<BeaconAnchor[]>([])
  const [buildingId, setBuildingId] = useState<string>(buildings[0]?.id ?? '')
  const [floor, setFloor] = useState<number | null>(null)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [spot, setSpot] = useState<BeaconAnchor['spot'] | null>(null)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')

  useEffect(() => setOrigin(window.location.origin), [])

  useEffect(() => {
    if (!buildingId) return
    setSelectedId(null)
    void fetch(`/api/beacon/anchors?buildingId=${encodeURIComponent(buildingId)}`)
      .then((response) => response.json() as Promise<{ anchors: BeaconAnchor[] }>)
      .then((body) => setAnchors(body.anchors))
      .catch(() => setAnchors([]))
  }, [buildingId])

  const floors = useMemo(
    () => [...new Set(anchors.map((anchor) => anchor.floor))].sort((a, b) => a - b),
    [anchors],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return anchors.filter((anchor) => {
      if (floor !== null && anchor.floor !== floor) return false
      if (spot !== null && anchor.spot !== spot) return false
      if (status === 'deployed' && !isDeployed(anchor)) return false
      if (status === 'pending' && isDeployed(anchor)) return false
      if (needle && !`${anchor.id} ${anchor.label}`.toLowerCase().includes(needle)) return false
      return true
    })
  }, [anchors, floor, spot, status, query])

  const selected = filtered.find((anchor) => anchor.id === selectedId) ?? filtered[0] ?? null
  const deployedCount = anchors.filter(isDeployed).length

  return (
    <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_minmax(320px,0.72fr)]">
      {/* ── Filter rail ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <Panel label="Block">
          <div className="flex flex-wrap gap-1.5 p-3">
            {buildings.map((building) => (
              <Chip
                key={building.id}
                active={building.id === buildingId}
                onClick={() => setBuildingId(building.id)}
              >
                {building.name}
              </Chip>
            ))}
          </div>
        </Panel>

        <Panel label="Floor">
          <div className="flex flex-wrap gap-1.5 p-3">
            <Chip active={floor === null} onClick={() => setFloor(null)}>
              All
            </Chip>
            {floors.map((value) => (
              <Chip
                key={value}
                active={floor === value}
                onClick={() => setFloor(floor === value ? null : value)}
              >
                F{value}
              </Chip>
            ))}
          </div>
        </Panel>

        <Panel label="Status">
          <div className="flex flex-wrap gap-1.5 p-3">
            {(['all', 'deployed', 'pending'] as const).map((value) => (
              <Chip
                key={value}
                active={status === value}
                tone={value === 'deployed' ? 'good' : value === 'pending' ? 'warn' : 'default'}
                onClick={() => setStatus(value)}
              >
                {value}
              </Chip>
            ))}
          </div>
        </Panel>

        <Panel label="Placement">
          <div className="flex flex-wrap gap-1.5 p-3">
            <Chip active={spot === null} onClick={() => setSpot(null)}>
              Any
            </Chip>
            {(['Stairwell', 'Corridor'] as const).map((value) => (
              <Chip key={value} active={spot === value} onClick={() => setSpot(spot === value ? null : value)}>
                {value}
              </Chip>
            ))}
          </div>
        </Panel>

        <Panel label="Coverage" spotlight>
          <div className="space-y-3 p-4">
            <Stat value={anchors.length} label="anchors in block" tone="accent" />
            <div>
              <MiniBar value={deployedCount} max={Math.max(1, anchors.length)} tone="good" />
              <p className="ops-label mt-1.5 text-ops-faint">
                {deployedCount} deployed · {anchors.length - deployedCount} pending
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {/* ── The list ───────────────────────────────────────────────────── */}
      <Panel
        label="Anchor registry"
        aside={<Chip tone="accent">{filtered.length} shown</Chip>}
        className="min-h-[560px]"
      >
        <div className="border-b border-ops-border/70 p-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a code or a room — BLK-C-F3-A1"
            className="w-full rounded-lg border border-ops-border bg-ops-bg px-3 py-2 font-mono text-[12px] uppercase text-ops-text placeholder:normal-case placeholder:text-ops-faint focus:border-ops-accent/50 focus:outline-none"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-[12px] text-ops-muted">
            No anchors match those filters.
          </p>
        ) : (
          <ul className="max-h-[460px] divide-y divide-ops-border/60 overflow-y-auto">
            {filtered.map((anchor) => {
              const active = selected?.id === anchor.id
              const deployed = isDeployed(anchor)
              const signal = signalFor(anchor)

              return (
                <li key={anchor.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(anchor.id)}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      active ? 'bg-ops-accent/10' : 'hover:bg-ops-lift/50'
                    }`}
                  >
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${deployed ? 'bg-emerald-400' : 'bg-sev-p1'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[12px] font-bold text-ops-text">{anchor.id}</p>
                      <p className="truncate text-[11px] text-ops-muted">{anchor.label}</p>
                    </div>
                    <div className="w-16 shrink-0">
                      <MiniBar value={signal} max={100} tone={signal > 85 ? 'good' : 'accent'} />
                      <p className="ops-label mt-1 text-right text-ops-faint">{signal}%</p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {/* ── Selected anchor ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {selected ? (
          <>
            <Panel label="Selected anchor" tone="accent" aside={<Chip tone="accent">99%</Chip>}>
              <div className="p-4">
                <p className="font-mono text-lg font-bold text-ops-text">{selected.id}</p>
                <p className="mt-0.5 text-[12px] text-ops-muted">{selected.label}</p>

                <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-ops-border/70 pt-3">
                  <Stat value={`F${selected.floor}`} label="floor" />
                  <Stat value={selected.spot} label="placement" />
                  <Stat value={signalFor(selected)} label="scan quality" tone="good" />
                  <Stat
                    value={isDeployed(selected) ? 'Deployed' : 'Pending'}
                    label="status"
                    tone={isDeployed(selected) ? 'good' : 'default'}
                  />
                </dl>

                <p className="mt-3 text-[11px] leading-relaxed text-ops-faint">
                  Scanning this code files a report already located to this room at 99% confidence
                  — with a floor, which GPS can never give.
                </p>
              </div>
            </Panel>

            <Panel label="Printable sheet" className="print-sheet">
              <div className="p-3">
                <AnchorSheet anchors={[selected]} origin={origin} />
              </div>
            </Panel>
          </>
        ) : (
          <Panel label="No anchor selected">
            <p className="px-4 py-6 text-[12px] text-ops-muted">
              Pick an anchor from the registry to see its detail and printable sheet.
            </p>
          </Panel>
        )}
      </div>
    </div>
  )
}
