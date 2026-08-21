'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { describeSlaClock } from '@/domain/queue'
import { readSla } from '@/domain/sla'
import { estimateArrival } from '@/domain/dispatch'
import type { Incident, IncidentStatus, Responder } from '@/domain/types'
import { SeverityBadge } from '@/components/ops/SeverityBadge'
import { StatusBadge } from '@/components/ops/StatusBadge'
import { IncidentTimeline } from '@/components/control/IncidentTimeline'
import { Chip, MiniBar, Panel, Stat } from '@/components/ui/Panel'
import { useLiveEvents } from '@/hooks/use-live-events'
import { useResponderTracking } from './use-responder-tracking'

const PIPELINE_EVENTS = ['incident.created', 'incident.updated', 'responder.moved'] as const

/** The advance a responder can make from each status, and its button label. */
const NEXT_ACTION: Partial<Record<IncidentStatus, { status: IncidentStatus; label: string }>> = {
  dispatched: { status: 'on-scene', label: 'Arrived on scene' },
  'on-scene': { status: 'resolved', label: 'Mark resolved' },
}

/**
 * The responder seat, as a command console.
 *
 * The assignment is still the one thing that matters, so it owns the largest
 * surface — but a responder walking into an incident also needs to know who
 * else is coming, what the clock says, and what has happened so far. Those sit
 * around the assignment rather than behind a tab.
 */
export function ResponderBoard() {
  const [responders, setResponders] = useState<Responder[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [responderId, setResponderId] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  const refresh = useCallback(async () => {
    const [respondersResponse, incidentsResponse] = await Promise.all([
      fetch('/api/responders'),
      fetch('/api/incidents'),
    ])
    if (!respondersResponse.ok || !incidentsResponse.ok) return

    const respondersBody = (await respondersResponse.json()) as { responders: Responder[] }
    const incidentsBody = (await incidentsResponse.json()) as { incidents: Incident[] }
    setResponders(respondersBody.responders)
    setIncidents(incidentsBody.incidents)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useLiveEvents(PIPELINE_EVENTS, () => {
    void refresh()
  })

  // Default to whoever actually has work, so the demo opens on a live case.
  useEffect(() => {
    if (responderId !== null || responders.length === 0) return
    const busy = responders.find((responder) => responder.incidentId !== null)
    setResponderId((busy ?? responders[0]).id)
  }, [responderId, responders])

  const responder = responders.find((item) => item.id === responderId) ?? null
  const assignment = incidents.find(
    (incident) =>
      responder !== null &&
      incident.assignedResponderIds.includes(responder.id) &&
      incident.status !== 'resolved',
  )

  const arrival = useResponderTracking({
    responderId: responder?.id ?? null,
    fallbackFrom: responder?.location ?? null,
    active: assignment !== undefined && assignment.status !== 'resolved',
  })

  const advance = async (status: IncidentStatus) => {
    if (!assignment || !responder) return
    await fetch(`/api/incidents/${assignment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, actor: responder.id }),
    })
    await refresh()
  }

  const crew = useMemo(
    () =>
      assignment
        ? responders.filter((item) => assignment.assignedResponderIds.includes(item.id))
        : [],
    [assignment, responders],
  )

  const openQueue = useMemo(
    () => incidents.filter((incident) => incident.status !== 'resolved'),
    [incidents],
  )
  const unassigned = useMemo(
    () => openQueue.filter((incident) => incident.assignedResponderIds.length === 0),
    [openQueue],
  )
  const recent = useMemo(
    () =>
      incidents
        .filter((incident) => incident.resolvedAt !== null)
        .sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? ''))
        .slice(0, 4),
    [incidents],
  )
  const resolvedToday = incidents.filter((incident) => incident.resolvedAt !== null).length
  const available = responders.filter((item) => item.status === 'available').length

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.8fr)]">
      {/* ── The assignment ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {!assignment ? (
          <>
            <Panel
              label="Standing by"
              tone="default"
              spotlight
              aside={<Chip tone="good">available</Chip>}
            >
              <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full border border-emerald-400/40 bg-emerald-400/10">
                  <span className="siren-pulse size-2 rounded-full bg-emerald-400" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-ops-text">No active assignment</p>
                  <p className="text-[12px] leading-relaxed text-ops-muted">
                    You appear in dispatch recommendations while available, ranked by unit first
                    and then distance. Anything matching you lands here instantly.
                  </p>
                </div>
              </div>
            </Panel>

            {/* Standing by is exactly when a responder has time to read the
                board, so the space an assignment would fill shows the board. */}
            <Panel
              label="Unassigned on the board"
              aside={<Chip tone={unassigned.length ? 'warn' : 'good'}>{unassigned.length}</Chip>}
            >
              {unassigned.length === 0 ? (
                <p className="px-4 py-6 text-[12px] leading-relaxed text-ops-muted">
                  Every open incident already has a unit on it. Nothing is waiting.
                </p>
              ) : (
                <ul className="divide-y divide-ops-border/60">
                  {unassigned.map((incident) => {
                    const sla = readSla(incident, now)
                    const distance = responder
                      ? estimateArrival(responder.location, incident.location)
                      : null
                    return (
                      <li key={incident.id} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={incident.severity} compact />
                          <StatusBadge status={incident.status} />
                          <span className="ops-label ml-auto text-ops-faint">
                            {describeSlaClock(sla.remainingMinutes)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[13px] text-ops-text">{incident.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-ops-muted">
                          <span>{incident.location.label}</span>
                          {distance && (
                            <span className="text-ops-accent">
                              {distance.distanceM}m · {distance.etaMinutes}m out
                            </span>
                          )}
                        </p>
                        <div className="mt-2">
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

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel label="Unit roster" aside={<Chip>{responders.length}</Chip>}>
                <ul className="divide-y divide-ops-border/60">
                  {responders.map((member) => (
                    <li key={member.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span
                        className={`size-1.5 shrink-0 rounded-full ${
                          member.status === 'available' ? 'bg-emerald-400' : 'bg-ops-accent'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-ops-text">
                          {member.name}
                          {member.id === responderId && (
                            <span className="ml-1.5 text-ops-accent">(you)</span>
                          )}
                        </p>
                        <p className="ops-label text-ops-faint">{member.unit}</p>
                      </div>
                      <span className="ops-label shrink-0 text-ops-muted">{member.status}</span>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel label="Recently resolved" aside={<Chip tone="good">{recent.length}</Chip>}>
                {recent.length === 0 ? (
                  <p className="px-4 py-6 text-[12px] text-ops-muted">
                    Nothing resolved yet this shift.
                  </p>
                ) : (
                  <ul className="divide-y divide-ops-border/60">
                    {recent.map((incident) => (
                      <li key={incident.id} className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <SeverityBadge severity={incident.severity} compact />
                          <span className="ops-label ml-auto text-emerald-400">resolved</span>
                        </div>
                        <p className="mt-1 truncate text-[12px] text-ops-text">{incident.title}</p>
                        <p className="truncate text-[11px] text-ops-faint">
                          {incident.location.label}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </>
        ) : (
          <Panel
            label="Active assignment"
            tone="accent"
            spotlight
            aside={
              <>
                <SeverityBadge severity={assignment.severity} compact />
                <StatusBadge status={assignment.status} />
              </>
            }
          >
            <div className="p-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-xl font-bold tracking-tight text-ops-text">
                  {assignment.title}
                </h2>
                <SlaClock incident={assignment} now={now} />
              </div>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ops-muted">
                {assignment.description}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <Stat
                  value={arrival ? `${arrival.distanceM}m` : '—'}
                  label="distance"
                  tone="accent"
                />
                <Stat
                  value={arrival ? `${arrival.etaMinutes}m` : '—'}
                  label="eta"
                  tone="accent"
                />
                <Stat value={assignment.reportCount} label="reports" />
                <Stat
                  value={`${Math.round(assignment.confidence * 100)}%`}
                  label="confidence"
                  tone={assignment.confidence > 0.8 ? 'good' : 'default'}
                />
              </div>

              <div className="mt-4 rounded-xl border border-ops-accent/30 bg-ops-accent/5 p-4">
                <p className="ops-label text-ops-accent">Go to</p>
                <p className="mt-1 text-[15px] font-medium text-ops-text">
                  {assignment.location.label}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-ops-muted">
                  {Math.round(assignment.location.confidence * 100)}% ·{' '}
                  {assignment.location.method}
                  {assignment.location.floor !== undefined && ` · floor ${assignment.location.floor}`}
                </p>

                {arrival && assignment.status !== 'on-scene' && (
                  <div className="mt-3">
                    <MiniBar value={Math.max(0, 400 - arrival.distanceM)} max={400} />
                    <p className="ops-label mt-1.5 flex items-center gap-1.5 text-ops-accent">
                      <span className="siren-pulse size-1.5 rounded-full bg-current" />
                      closing · {arrival.distanceM}m out
                    </p>
                  </div>
                )}
              </div>

              {(() => {
                const action = NEXT_ACTION[assignment.status]
                if (!action) return null
                return (
                  <button
                    type="button"
                    onClick={() => void advance(action.status)}
                    className="mt-4 w-full rounded-xl border border-ops-accent/40 bg-ops-accent/10 py-4 text-[15px] font-semibold text-ops-accent transition-colors hover:bg-ops-accent/20 active:scale-[0.99]"
                  >
                    {action.label}
                  </button>
                )
              })()}
            </div>
          </Panel>
        )}

        {assignment && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel label="Crew on this incident" aside={<Chip tone="accent">{crew.length}</Chip>}>
              <ul className="divide-y divide-ops-border/60">
                {crew.map((member) => {
                  const memberArrival = estimateArrival(member.location, assignment.location)
                  const onScene = assignment.status === 'on-scene'
                  return (
                    <li key={member.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span
                        className={`size-1.5 shrink-0 rounded-full ${onScene ? 'bg-emerald-400' : 'siren-pulse bg-ops-accent'}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-ops-text">
                          {member.name}
                          {member.id === responderId && (
                            <span className="ml-1.5 text-ops-accent">(you)</span>
                          )}
                        </p>
                        <p className="ops-label text-ops-faint">{member.unit}</p>
                      </div>
                      <span className="ops-label shrink-0 text-ops-muted">
                        {onScene ? 'on scene' : `${memberArrival.etaMinutes}m out`}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Panel>

            <IncidentTimeline entries={assignment.timeline} />
          </div>
        )}
      </div>

      {/* ── Context rail ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <Panel label="Signed in as">
          <div className="p-4">
            <select
              value={responderId ?? ''}
              onChange={(event) => setResponderId(event.target.value)}
              className="w-full rounded-lg border border-ops-border bg-ops-bg px-3 py-2.5 text-[13px] text-ops-text focus:border-ops-accent/50 focus:outline-none"
            >
              {responders.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {item.unit}
                </option>
              ))}
            </select>

            {responder && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip tone={responder.status === 'available' ? 'good' : 'accent'}>
                  {responder.status}
                </Chip>
                <Chip>{responder.unit}</Chip>
                <Chip title="Position streams only while you have an assignment">
                  {assignment ? 'tracking on' : 'tracking off'}
                </Chip>
              </div>
            )}
          </div>
        </Panel>

        <Panel label="Shift at a glance" spotlight>
          <div className="grid grid-cols-3 gap-3 p-4">
            <Stat value={openQueue.length} label="open board" tone={openQueue.length ? 'warn' : 'good'} />
            <Stat value={available} label="units free" tone="good" />
            <Stat value={resolvedToday} label="resolved" />
          </div>
        </Panel>

        <Panel
          label="Board"
          aside={<Chip tone={openQueue.length ? 'warn' : 'good'}>{openQueue.length} open</Chip>}
        >
          {openQueue.length === 0 ? (
            <p className="px-4 py-5 text-[12px] text-ops-muted">
              Board clear. Every SLA clock is stopped.
            </p>
          ) : (
            <ul className="divide-y divide-ops-border/60">
              {openQueue.slice(0, 6).map((incident) => {
                const sla = readSla(incident, now)
                const mine = responder !== null && incident.assignedResponderIds.includes(responder.id)
                return (
                  <li key={incident.id} className={`px-4 py-2.5 ${mine ? 'bg-ops-accent/5' : ''}`}>
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={incident.severity} compact />
                      <span className="ops-label ml-auto text-ops-faint">
                        {describeSlaClock(sla.remainingMinutes)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[12px] text-ops-text">{incident.title}</p>
                    <p className="truncate text-[11px] text-ops-faint">{incident.location.label}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

function SlaClock({ incident, now }: { incident: Incident; now: Date }) {
  const sla = readSla(incident, now)

  return (
    <span
      className={`ops-label ${sla.breached ? 'siren-pulse text-sev-p0' : 'text-ops-muted'}`}
    >
      {describeSlaClock(sla.remainingMinutes)}
    </span>
  )
}
