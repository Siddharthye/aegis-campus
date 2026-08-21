'use client'

import { useCallback, useEffect, useState } from 'react'
import type { DispatchRecommendation } from '@/domain/dispatch'
import { rankByPressure, type QueueEntry } from '@/domain/queue'
import type { Incident, IncidentStatus } from '@/domain/types'
import { useLiveEvents } from '@/hooks/use-live-events'
import { IntegrationSlot } from '@/integrations/slots'
import { DrillPanel } from './DrillPanel'
import { IncidentDetail } from './IncidentDetail'
import { IncidentQueue } from './IncidentQueue'
import { SentinelLane } from './SentinelLane'

const PIPELINE_EVENTS = ['incident.created', 'incident.updated', 'incident.broadcast'] as const

/** How often SLA clocks re-rank the queue without any incident changing. */
const CLOCK_TICK_MS = 5_000

/**
 * The dispatcher console.
 *
 * Queue ordering is recomputed on the client from `rankByPressure` rather than
 * being served pre-sorted, because SLA pressure changes with the clock even
 * when nothing about the incidents changes — a queue that only re-sorts on
 * server events would silently go stale between them.
 */
export function ControlRoom() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<DispatchRecommendation[]>([])
  const [now, setNow] = useState(() => new Date())

  const refreshIncidents = useCallback(async () => {
    const response = await fetch('/api/incidents')
    if (!response.ok) return
    const body = (await response.json()) as { incidents: Incident[] }
    setIncidents(body.incidents)
  }, [])

  const refreshSelected = useCallback(async (incidentId: string) => {
    const response = await fetch(`/api/incidents/${incidentId}`)
    if (!response.ok) return
    const body = (await response.json()) as {
      incident: Incident
      recommendations: DispatchRecommendation[]
    }
    setRecommendations(body.recommendations)
    setIncidents((current) =>
      current.map((incident) => (incident.id === incidentId ? body.incident : incident)),
    )
  }, [])

  useEffect(() => {
    void refreshIncidents()
  }, [refreshIncidents])

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), CLOCK_TICK_MS)
    return () => clearInterval(interval)
  }, [])

  useLiveEvents(PIPELINE_EVENTS, () => {
    void refreshIncidents()
    if (selectedId) void refreshSelected(selectedId)
  })

  useEffect(() => {
    if (selectedId) void refreshSelected(selectedId)
  }, [selectedId, refreshSelected])

  const queue: QueueEntry[] = rankByPressure(incidents, now)
  const selected = incidents.find((incident) => incident.id === selectedId) ?? null

  // Keep a selection alive as the queue churns, so a dispatcher is never
  // dropped back to an empty pane mid-incident.
  useEffect(() => {
    if (selectedId === null && queue.length > 0) setSelectedId(queue[0].incident.id)
  }, [selectedId, queue])

  const patchIncident = async (incidentId: string, body: Record<string, unknown>) => {
    await fetch(`/api/incidents/${incidentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    await Promise.all([refreshIncidents(), refreshSelected(incidentId)])
  }

  const broadcast = async (incidentId: string, message: string) => {
    await fetch(`/api/incidents/${incidentId}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, actor: 'dispatcher' }),
    })
    await Promise.all([refreshIncidents(), refreshSelected(incidentId)])
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.9fr)]">
      <div className="flex flex-col gap-3">
        <p className="ops-label text-ops-muted">
          Queue · {queue.length} open · ranked by SLA pressure
        </p>
        <IncidentQueue entries={queue} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      <div>
        {selected ? (
          <IncidentDetail
            incident={selected}
            recommendations={recommendations}
            onAssign={(responderId) =>
              patchIncident(selected.id, { assignResponderId: responderId, actor: 'dispatcher' })
            }
            onAdvance={(status: IncidentStatus) =>
              patchIncident(selected.id, { status, actor: 'dispatcher' })
            }
            onBroadcast={(message) => broadcast(selected.id, message)}
          />
        ) : (
          <div className="rounded-lg border border-ops-border bg-ops-panel p-6 text-center">
            <p className="ops-label text-ops-faint">No incident selected</p>
            <p className="mt-1.5 text-[12px] text-ops-muted">
              Select an incident from the queue, or run a drill to generate one.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <SentinelLane />
        <DrillPanel onPipelineChange={() => void refreshIncidents()} />
        <IntegrationSlot kind="sensor-feed" label="Sensor feed" showWhenEmpty />
        <IntegrationSlot kind="alert-channel" label="Broadcast channel" />
        <IntegrationSlot kind="analytics-panel" label="Acquired module" />
      </div>
    </div>
  )
}
