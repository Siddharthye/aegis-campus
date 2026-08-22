'use client'

import { useCallback, useEffect, useState } from 'react'
import { estimateArrival } from '@/domain/dispatch'
import { judgeAssignment } from '@/domain/dispatch-escalation'
import type { Incident, Responder } from '@/domain/types'
import { useLiveEvents } from '@/hooks/use-live-events'
import { useLiveClock } from '@/components/ui/use-live-clock'

const MOVEMENT_EVENTS = ['responder.moved'] as const

/**
 * The units committed to this incident, with an ETA that decays as they move.
 *
 * Recomputed on the client from each reported position rather than shown as
 * the estimate made at assignment time — a dispatcher deciding whether to send
 * a second unit needs to know where the first one *is*, not where it was when
 * they pressed the button.
 */
export function AssignedUnits({ incident }: { incident: Incident }) {
  const [responders, setResponders] = useState<Responder[]>([])
  const now = useLiveClock()

  const refresh = useCallback(async () => {
    const response = await fetch('/api/responders')
    if (!response.ok) return
    const body = (await response.json()) as { responders: Responder[] }
    setResponders(body.responders)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLiveEvents(MOVEMENT_EVENTS, () => {
    void refresh()
  })

  const assigned = responders.filter((responder) =>
    incident.assignedResponderIds.includes(responder.id),
  )
  if (assigned.length === 0) return null

  /* The acknowledgement ladder runs against the assignment, not against each
     responder — one incident, one clock, one escalation.

     Movement counts as acknowledgement: a responder who is en route or on
     scene has plainly seen the job, whatever button they did or did not
     press. Only genuine silence escalates. */
  const dispatchedAt = incident.timeline.find((event) => event.action === 'dispatched')?.at
  const answered = assigned.some(
    (responder) => responder.status === 'en-route' || responder.status === 'on-scene',
  )
  const silence =
    now && dispatchedAt
      ? judgeAssignment(
          {
            severity: incident.severity,
            assignedAt: dispatchedAt,
            acknowledgedAt: answered ? (incident.timeline.at(-1)?.at ?? null) : null,
            tier: 'responder',
          },
          now,
        )
      : null

  return (
    <section className="rounded-lg border border-ops-border bg-ops-panel p-4">
      <p className="ops-label text-ops-muted">Units en route</p>

      <ul className="mt-2 flex flex-col gap-1.5">
        {assigned.map((responder) => {
          const { distanceM, etaMinutes } = estimateArrival(responder.location, incident.location)
          const arrived = responder.status === 'on-scene' || incident.status === 'on-scene'

          return (
            <li
              key={responder.id}
              className="flex items-center gap-3 rounded-md border border-ops-border bg-ops-bg p-2.5"
            >
              <span
                className={`size-1.5 shrink-0 rounded-full ${
                  arrived ? 'bg-emerald-400' : 'siren-pulse bg-ops-accent'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-ops-text">
                  {responder.name}
                  <span className="ml-1.5 text-ops-faint">{responder.unit}</span>
                </p>
                <p className="font-mono text-[11px] text-ops-muted">
                  {responder.location.lat.toFixed(5)}, {responder.location.lng.toFixed(5)}
                </p>
              </div>

              <span
                className={`ops-label shrink-0 ${arrived ? 'text-emerald-400' : 'text-ops-accent'}`}
              >
                {arrived ? 'On scene' : `${distanceM}m · ${etaMinutes}m out`}
              </span>
            </li>
          )
        })}
      </ul>

      {silence?.overdue && (
        <p className="mt-2.5 rounded-md border border-sev-p0/40 bg-sev-p0/10 px-2.5 py-2 text-[11px] leading-relaxed text-sev-p0">
          {silence.reason}
        </p>
      )}
    </section>
  )
}
