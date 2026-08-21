'use client'

import { useState } from 'react'
import type { DispatchRecommendation } from '@/domain/dispatch'
import type { Incident, IncidentStatus } from '@/domain/types'
import { SeverityBadge } from '@/components/ops/SeverityBadge'
import { StatusBadge } from '@/components/ops/StatusBadge'
import { AssignedUnits } from './AssignedUnits'
import { BroadcastComposer } from './BroadcastComposer'
import { EvacuationPanel } from './EvacuationPanel'
import { EvidenceStrip } from './EvidenceStrip'
import { IncidentTimeline } from './IncidentTimeline'

/** The transition offered next, per current status. Resolved offers nothing. */
const NEXT_STATUS: Partial<Record<IncidentStatus, IncidentStatus>> = {
  reported: 'triaged',
  triaged: 'dispatched',
  dispatched: 'on-scene',
  'on-scene': 'resolved',
}

interface IncidentDetailProps {
  incident: Incident
  recommendations: DispatchRecommendation[]
  onAssign: (responderId: string) => Promise<void>
  onAdvance: (status: IncidentStatus) => Promise<void>
  onBroadcast: (message: string) => Promise<void>
}

/**
 * Everything a dispatcher needs about one incident: what it is, where it is
 * and how sure we are of that, who to send and why, and the audit trail.
 */
export function IncidentDetail({
  incident,
  recommendations,
  onAssign,
  onAdvance,
  onBroadcast,
}: IncidentDetailProps) {
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const nextStatus = NEXT_STATUS[incident.status]

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }

  const sendBroadcast = async () => {
    const message = broadcastMessage.trim()
    if (!message) return
    await run(() => onBroadcast(message))
    setBroadcastMessage('')
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="rounded-lg border border-ops-border bg-ops-panel p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={incident.severity} />
          <StatusBadge status={incident.status} />
          <span className="ops-label ml-auto text-ops-faint">{incident.id}</span>
        </div>

        <h2 className="mt-2 text-[15px] font-semibold text-ops-text">{incident.title}</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-ops-muted">{incident.description}</p>

        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-ops-border pt-3 sm:grid-cols-4">
          <Fact label="Location" value={incident.location.label} />
          <Fact
            label="Confidence"
            value={`${Math.round(incident.location.confidence * 100)}% · ${incident.location.method}`}
          />
          <Fact label="Reports" value={String(incident.reportCount)} />
          <Fact
            label="Reporter"
            value={incident.reporterId ?? 'Anonymous'}
          />
        </dl>

        {nextStatus && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => onAdvance(nextStatus))}
            className="mt-3 rounded-md border border-ops-accent/40 bg-ops-accent/10 px-3 py-1.5 text-[12px] font-medium text-ops-accent transition-colors hover:bg-ops-accent/20 disabled:opacity-50"
          >
            Advance to {nextStatus}
          </button>
        )}
      </header>

      {recommendations.length > 0 && (
        <section className="rounded-lg border border-ops-border bg-ops-panel p-4">
          <p className="ops-label text-ops-muted">Dispatch recommendations</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {recommendations.slice(0, 3).map(({ responder, etaMinutes, reason }) => (
              <li
                key={responder.id}
                className="flex items-center gap-3 rounded-md border border-ops-border bg-ops-bg p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-ops-text">
                    {responder.name}
                    <span className="ml-1.5 text-ops-faint">{responder.unit}</span>
                  </p>
                  <p className="truncate text-[11px] text-ops-muted">{reason}</p>
                </div>
                <span className="ops-label shrink-0 text-ops-accent">ETA {etaMinutes}m</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => onAssign(responder.id))}
                  className="shrink-0 rounded-md border border-ops-accent/40 bg-ops-accent/10 px-2.5 py-1 text-[11px] font-medium text-ops-accent transition-colors hover:bg-ops-accent/20 disabled:opacity-50"
                >
                  Dispatch
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <EvidenceStrip evidence={incident.evidence} />

      <AssignedUnits incident={incident} />

      <EvacuationPanel incident={incident} onUseInstruction={setBroadcastMessage} />

      <BroadcastComposer incident={incident} onUseTemplate={setBroadcastMessage} />

      <section className="rounded-lg border border-ops-border bg-ops-panel p-4">
        <p className="ops-label text-ops-muted">Geofenced broadcast</p>
        <div className="mt-2 flex gap-2">
          <input
            value={broadcastMessage}
            onChange={(event) => setBroadcastMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void sendBroadcast()
            }}
            placeholder="Evacuate via the west stairwell. Do not use lifts."
            className="min-w-0 flex-1 rounded-md border border-ops-border bg-ops-bg px-2.5 py-1.5 text-[12px] text-ops-text placeholder:text-ops-faint focus:border-ops-accent/50 focus:outline-none"
          />
          <button
            type="button"
            disabled={busy || broadcastMessage.trim().length === 0}
            onClick={() => void sendBroadcast()}
            className="shrink-0 rounded-md bg-sev-p0 px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Broadcast
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-ops-faint">
          Delivered by SIREN to everyone inside the incident geofence.
        </p>
      </section>

      <IncidentTimeline entries={incident.timeline} />
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="ops-label text-ops-faint">{label}</dt>
      <dd className="mt-0.5 truncate text-[12px] text-ops-text">{value}</dd>
    </div>
  )
}
