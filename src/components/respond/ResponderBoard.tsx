'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Incident, IncidentStatus, Responder } from '@/domain/types'
import { IncidentTimeline } from '@/components/control/IncidentTimeline'
import { useLiveEvents } from '@/hooks/use-live-events'
import { ActiveAssignment } from './ActiveAssignment'
import { ContextRail } from './ContextRail'
import { CrewPanel } from './CrewPanel'
import { StandingBy } from './StandingBy'
import { useResponderTracking } from './use-responder-tracking'

const PIPELINE_EVENTS = ['incident.created', 'incident.updated', 'responder.moved'] as const

/** How many closed incidents the standing-by view looks back over. */
const RECENT_LIMIT = 4

/**
 * The responder seat, as a command console.
 *
 * This file owns the data and the two-column split, nothing else. The
 * assignment is the one thing that matters, so it takes the wide column and
 * swaps between two states — standing by, or working. Everything a responder
 * needs *around* that decision lives in the rail beside it rather than behind
 * a tab, because none of it is worth a tap while walking.
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
      assignment ? responders.filter((item) => assignment.assignedResponderIds.includes(item.id)) : [],
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
        .slice(0, RECENT_LIMIT),
    [incidents],
  )

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.8fr)]">
      <div className="flex flex-col gap-4">
        {assignment ? (
          <ActiveAssignment
            incident={assignment}
            now={now}
            arrival={arrival}
            onAdvance={(status) => void advance(status)}
          />
        ) : (
          <StandingBy
            responders={responders}
            unassigned={unassigned}
            recent={recent}
            you={responder}
            now={now}
          />
        )}

        {assignment && (
          <div className="grid gap-4 lg:grid-cols-2">
            <CrewPanel incident={assignment} crew={crew} youId={responderId} />
            <IncidentTimeline entries={assignment.timeline} />
          </div>
        )}
      </div>

      <ContextRail
        responders={responders}
        openQueue={openQueue}
        you={responder}
        tracking={assignment !== undefined}
        resolvedToday={incidents.filter((incident) => incident.resolvedAt !== null).length}
        now={now}
        onSignIn={setResponderId}
      />
    </div>
  )
}
