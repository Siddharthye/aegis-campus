'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CAMPUS_CENTRE } from '@/data/campus'
import { CAMPUS_FLOORS, FLOOR_SPACES, FLOOR_WINGS } from '@/data/floorplan'
import type { Incident, LocatedPosition } from '@/domain/types'
import { readSla } from '@/domain/sla'
import { SeverityBadge } from '@/components/ops/SeverityBadge'
import { StatusBadge } from '@/components/ops/StatusBadge'
import { Chip, MiniBar, Panel, Stat } from '@/components/ui/Panel'
import { useLiveEvents } from '@/hooks/use-live-events'
import { IntegrationSlot } from '@/integrations/slots'
import { FloorPlan3D, type FloorSelection } from './FloorPlan3D'
import { ReportWizard } from './ReportWizard'

const PIPELINE_EVENTS = ['incident.created', 'incident.updated'] as const

/**
 * The reporter's workspace: the floor you are standing on, and the form.
 *
 * The plan is the centrepiece rather than an illustration — picking a room
 * sets the incident's location at room-level precision, which is exactly the
 * argument BEACON makes with printed anchors, made visible for anyone who
 * would rather point than type a code.
 */
export function ReportWorkspace() {
  const [selection, setSelection] = useState<FloorSelection | null>(null)
  const [wing, setWing] = useState<'A' | 'B' | 'C' | null>(null)
  const [incidents, setIncidents] = useState<Incident[]>([])

  const refresh = useCallback(async () => {
    const response = await fetch('/api/incidents')
    if (!response.ok) return
    const body = (await response.json()) as { incidents: Incident[] }
    setIncidents(body.incidents)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLiveEvents(PIPELINE_EVENTS, () => {
    void refresh()
  })

  const open = useMemo(
    () => incidents.filter((incident) => incident.status !== 'resolved'),
    [incidents],
  )

  /* Rooms with an open incident, so the plan shows where trouble already is. */
  const activeRoomIds = useMemo(() => {
    const labels = new Set(open.map((incident) => incident.location.label))
    return FLOOR_SPACES.filter((space) =>
      [...labels].some((label) => label.includes(space.id)),
    ).map((space) => space.id)
  }, [open])

  /**
   * A room pick becomes a real located position. Confidence sits between a
   * scanned QR anchor and a map tap: the reporter named the room, but nothing
   * physically verified they are in it.
   */
  const pickedLocation: LocatedPosition | null = selection
    ? {
        lat: CAMPUS_CENTRE.lat,
        lng: CAMPUS_CENTRE.lng,
        label: selection.label,
        method: 'map-tap',
        confidence: 0.85,
        floor: 2,
        buildingId: `block-${selection.space.wing.toLowerCase()}`,
      }
    : null

  const byWing = FLOOR_WINGS.map((entry) => ({
    ...entry,
    count: FLOOR_SPACES.filter((space) => space.wing === entry.id).length,
  }))

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(380px,0.85fr)]">
      {/* ── The floor ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <Panel
          label="Campus 25 · Second Floor"
          aside={
            <>
              <Chip active={wing === null} onClick={() => setWing(null)}>
                All
              </Chip>
              {byWing.map((entry) => (
                <Chip
                  key={entry.id}
                  active={wing === entry.id}
                  onClick={() => setWing(wing === entry.id ? null : entry.id)}
                  title={entry.hint}
                >
                  {entry.label}
                </Chip>
              ))}
            </>
          }
          className="min-h-[560px]"
        >
          <div className="p-3 pb-4">
            <FloorPlan3D
              selectedId={selection?.space.id ?? null}
              onSelect={setSelection}
              activeIds={activeRoomIds}
              wing={wing}
              className="h-[470px]"
            />
          </div>
        </Panel>

        <div className="grid gap-4 sm:grid-cols-3">
          <Panel label="This floor" spotlight>
            <div className="grid grid-cols-3 gap-3 p-4">
              <Stat value={FLOOR_SPACES.length} label="spaces" />
              <Stat value={activeRoomIds.length} label="active" tone={activeRoomIds.length ? 'danger' : 'good'} />
              <Stat value={3} label="wings" tone="accent" />
            </div>
          </Panel>

          <Panel label="Other floors" className="sm:col-span-2">
            <ul className="flex flex-col gap-1.5 p-3">
              {CAMPUS_FLOORS.map((floor) => (
                <li key={floor.id} className="flex items-center gap-3 rounded-lg bg-ops-bg/60 px-3 py-2">
                  <span className="font-mono text-[12px] text-ops-text">{floor.label}</span>
                  <span className="ml-auto">
                    {floor.surveyed ? (
                      <Chip tone="good">Surveyed</Chip>
                    ) : (
                      <Chip title="Plan not yet digitised — reports fall back to QR anchors and GPS">
                        Plan pending
                      </Chip>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      {/* ── The form and its context ───────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <Panel
          label={selection ? 'Selected location' : 'No room selected'}
          tone={selection ? 'accent' : 'default'}
          aside={selection && <Chip tone="accent">85% confidence</Chip>}
        >
          <div className="p-4">
            {selection ? (
              <>
                <p className="font-mono text-lg font-bold text-ops-text">{selection.space.id}</p>
                <p className="mt-0.5 text-[12px] text-ops-muted">
                  {selection.space.note ?? `${selection.space.wing} Block · ${selection.space.kind}`}
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-ops-faint">
                  Picked from the plan. Scanning the printed QR anchor in this room raises it to
                  99% — the difference between &ldquo;said the room&rdquo; and &ldquo;stood in it&rdquo;.
                </p>
              </>
            ) : (
              <p className="text-[12px] leading-relaxed text-ops-muted">
                Tap a room on the plan to attach it to your report, or leave it and use a QR
                anchor, the campus map, or GPS in the form below.
              </p>
            )}
          </div>
        </Panel>

        <Panel label="File a report" spotlight>
          <div className="p-4">
            <ReportWizard presetLocation={pickedLocation} />
          </div>
        </Panel>

        <Panel
          label="Live on campus"
          aside={<Chip tone={open.length ? 'warn' : 'good'}>{open.length} open</Chip>}
        >
          {open.length === 0 ? (
            <p className="px-4 py-5 text-[12px] text-ops-muted">
              Nothing open right now. Anything you file appears in the control room instantly.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-ops-border/60">
              {open.slice(0, 4).map((incident) => {
                const sla = readSla(incident, new Date())
                return (
                  <li key={incident.id} className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={incident.severity} compact />
                      <StatusBadge status={incident.status} />
                      <span className="ops-label ml-auto text-ops-faint">
                        {incident.reportCount} report{incident.reportCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate text-[12px] text-ops-text">{incident.title}</p>
                    <div className="mt-1.5">
                      <MiniBar
                        value={Math.min(sla.elapsedMinutes, sla.targetMinutes)}
                        max={sla.targetMinutes}
                        tone={sla.breached ? 'danger' : 'accent'}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <IntegrationSlot kind="intake-channel" label="Other ways to report" showWhenEmpty />
      </div>
    </div>
  )
}
