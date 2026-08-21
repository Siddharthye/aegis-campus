'use client'

import { useCallback, useEffect, useState } from 'react'
import { describeSlaClock } from '@/domain/queue'
import { readSla } from '@/domain/sla'
import type { Incident, IncidentStatus, Responder } from '@/domain/types'
import { SeverityBadge } from '@/components/ops/SeverityBadge'
import { StatusBadge } from '@/components/ops/StatusBadge'
import { useLiveEvents } from '@/hooks/use-live-events'

const PIPELINE_EVENTS = ['incident.created', 'incident.updated'] as const

/** The advance a responder can make from each status, and its button label. */
const NEXT_ACTION: Partial<Record<IncidentStatus, { status: IncidentStatus; label: string }>> = {
  dispatched: { status: 'on-scene', label: 'Arrived on scene' },
  'on-scene': { status: 'resolved', label: 'Mark resolved' },
}

/**
 * The responder seat: one assignment, thumb-sized controls, a live SLA clock.
 *
 * Deliberately the sparsest screen in the product. A responder is walking,
 * possibly running, and needs one decision at a time — not a dashboard.
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

  const advance = async (status: IncidentStatus) => {
    if (!assignment || !responder) return
    await fetch(`/api/incidents/${assignment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, actor: responder.id }),
    })
    await refresh()
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <label className="flex items-center gap-2">
        <span className="ops-label text-ops-muted">Signed in as</span>
        <select
          value={responderId ?? ''}
          onChange={(event) => setResponderId(event.target.value)}
          className="flex-1 rounded-md border border-ops-border bg-ops-panel px-2.5 py-1.5 text-[12px] text-ops-text focus:border-ops-accent/50 focus:outline-none"
        >
          {responders.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} — {item.unit}
            </option>
          ))}
        </select>
      </label>

      {!assignment && (
        <div className="rounded-lg border border-ops-border bg-ops-panel p-6 text-center">
          <p className="ops-label text-emerald-400">Standing by</p>
          <p className="mt-1.5 text-[12px] text-ops-muted">
            No active assignment. You will appear in dispatch recommendations while available.
          </p>
        </div>
      )}

      {assignment && (
        <article className="rounded-lg border border-ops-border bg-ops-panel p-4">
          <div className="flex items-center gap-2">
            <SeverityBadge severity={assignment.severity} />
            <StatusBadge status={assignment.status} />
            <SlaClock incident={assignment} now={now} />
          </div>

          <h2 className="mt-3 text-[16px] font-semibold text-ops-text">{assignment.title}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ops-muted">{assignment.description}</p>

          <div className="mt-3 rounded-md border border-ops-accent/30 bg-ops-accent/5 p-3">
            <p className="ops-label text-ops-accent">Go to</p>
            <p className="mt-1 text-[14px] text-ops-text">{assignment.location.label}</p>
            <p className="mt-0.5 font-mono text-[11px] text-ops-muted">
              {Math.round(assignment.location.confidence * 100)}% confidence ·{' '}
              {assignment.location.method}
              {assignment.location.floor !== undefined && ` · floor ${assignment.location.floor}`}
            </p>
          </div>

          {(() => {
            const action = NEXT_ACTION[assignment.status]
            if (!action) return null
            return (
              <button
                type="button"
                onClick={() => void advance(action.status)}
                className="mt-4 w-full rounded-md border border-ops-accent/40 bg-ops-accent/10 py-3.5 text-[14px] font-semibold text-ops-accent transition-colors hover:bg-ops-accent/20"
              >
                {action.label}
              </button>
            )
          })()}
        </article>
      )}
    </div>
  )
}

function SlaClock({ incident, now }: { incident: Incident; now: Date }) {
  const sla = readSla(incident, now)

  return (
    <span
      className={`ops-label ml-auto ${sla.breached ? 'siren-pulse text-sev-p0' : 'text-ops-muted'}`}
    >
      {describeSlaClock(sla.remainingMinutes)}
    </span>
  )
}
