'use client'

import { useCallback, useEffect, useState } from 'react'
import type { DispatchRecommendation } from '@/domain/dispatch'
import { rankByPressure, type QueueEntry } from '@/domain/queue'
import type { Incident, IncidentStatus } from '@/domain/types'
import { useLiveEvents } from '@/hooks/use-live-events'
import { Chip, Panel, Stat } from '@/components/ui/Panel'
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
export function ControlRoom({ initialIncidentId }: { initialIncidentId?: string }) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  // The command palette deep-links here as /control?incident=<id>.
  const [selectedId, setSelectedId] = useState<string | null>(initialIncidentId ?? null)
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

  const breaching = queue.filter((entry) => entry.breached).length
  const p0 = queue.filter((entry) => entry.incident.severity === 'P0').length
  const totalReports = queue.reduce((sum, entry) => sum + entry.incident.reportCount, 0)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* One strip of numbers across the top, so the three columns below start
          at the same line instead of each growing its own header. */}
      <Panel spotlight>
        <div className="grid grid-cols-3 gap-4 p-4 sm:grid-cols-6">
          <Stat value={queue.length} label="open" tone={queue.length ? 'accent' : 'good'} />
          <Stat value={p0} label="P0 active" tone={p0 ? 'danger' : 'good'} />
          <Stat value={breaching} label="SLA breaching" tone={breaching ? 'danger' : 'good'} />
          <Stat value={totalReports} label="reports fused" />
          <Stat value={incidents.length} label="total today" />
          <Stat
            value={queue.length ? Math.round(queue[0].pressure * 100) + '%' : '—'}
            label="top pressure"
            tone={queue.length && queue[0].breached ? 'danger' : 'accent'}
            hint="How far through its SLA the most urgent incident is"
          />
        </div>
      </Panel>

      <div className="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(240px,0.75fr)_minmax(0,1.7fr)_minmax(260px,0.8fr)] xl:gap-4">
      <Panel
        label="Queue"
        aside={
          <Chip tone={breaching ? 'danger' : queue.length ? 'accent' : 'good'}>
            {queue.length} open
          </Chip>
        }
        className="min-w-0"
      >
        <div className="max-h-[560px] overflow-y-auto p-2.5">
          <p className="ops-label mb-2 px-1 text-ops-faint">Ranked by SLA pressure</p>
          <IncidentQueue entries={queue} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </Panel>

      <div className="min-w-0 space-y-3">
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
          <Panel label="No incident selected" spotlight>
            <div className="p-5">
              <p className="text-[13px] leading-relaxed text-ops-muted">
                Pick an incident from the queue to see its dispatch options, evacuation guidance
                and audit trail — or run a drill to generate a full one end to end.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-ops-border/70 pt-4">
                <Stat value={queue.length} label="waiting" tone={queue.length ? 'accent' : 'good'} />
                <Stat value={breaching} label="breaching" tone={breaching ? 'danger' : 'good'} />
                <Stat value={totalReports} label="reports" />
              </div>
              <p className="mt-3 flex flex-wrap gap-1.5">
                <Chip tone="accent">SSE live</Chip>
                <Chip>ranked by SLA pressure</Chip>
                <Chip>fusion on intake</Chip>
              </p>
            </div>
          </Panel>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <SentinelLane />

        <DrillPanel onPipelineChange={() => void refreshIncidents()} />
        <IntegrationSlot kind="sensor-feed" label="Sensor feed" showWhenEmpty />
        <IntegrationSlot kind="alert-channel" label="Broadcast channel" />
        <IntegrationSlot kind="analytics-panel" label="Acquired module" />
      </div>
      </div>
    </div>
  )
}
