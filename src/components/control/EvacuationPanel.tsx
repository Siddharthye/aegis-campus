'use client'

import { useEffect, useState } from 'react'
import type { EvacuationPlan } from '@/domain/evacuation'
import type { Incident } from '@/domain/types'

interface EvacuationResponse {
  plan: EvacuationPlan | null
  warranted: boolean
}

interface EvacuationPanelProps {
  incident: Incident
  /** Loads the instruction into the broadcast box rather than sending it. */
  onUseInstruction: (instruction: string) => void
}

/**
 * Evacuation guidance for the dispatcher.
 *
 * Deliberately does not send anything itself. It computes the recommendation
 * and hands it to the broadcast box, because a human must read the words that
 * are about to be pushed to every phone on campus before they go — automation
 * decides *what to suggest*, never *what to announce*.
 */
export function EvacuationPanel({ incident, onUseInstruction }: EvacuationPanelProps) {
  const [result, setResult] = useState<EvacuationResponse | null>(null)

  useEffect(() => {
    setResult(null)
    void fetch(`/api/evacuation?incidentId=${encodeURIComponent(incident.id)}`)
      .then((response) => response.json() as Promise<EvacuationResponse>)
      .then(setResult)
      .catch(() => {
        // Guidance is advisory; a failed lookup must not block dispatch.
      })
  }, [incident.id, incident.severity, incident.location.lat, incident.location.lng])

  if (!result || !result.warranted) return null

  if (!result.plan) {
    return (
      <section className="rounded-lg border border-sev-p0/40 bg-sev-p0/5 p-4">
        <p className="ops-label text-sev-p0">Evacuation</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-ops-muted">
          Every muster point is within the hazard radius. Escalate to a manual assembly
          decision — do not broadcast an automated destination.
        </p>
      </section>
    )
  }

  const { plan } = result

  return (
    <section className="rounded-lg border border-sev-p1/40 bg-sev-p1/5 p-4">
      <div className="flex items-center gap-2">
        <p className="ops-label text-sev-p1">Evacuation guidance</p>
        <span className="ops-label ml-auto text-ops-faint">
          {plan.distanceM}m · ~{plan.walkMinutes} min
        </span>
      </div>

      <p className="mt-2 text-[13px] font-medium text-ops-text">
        {plan.zone.name}
        <span className="ml-1.5 font-normal text-ops-muted">
          — head {plan.direction}, {plan.zone.landmark}
        </span>
      </p>

      {plan.avoid.length > 0 && (
        <p className="mt-1 text-[11px] text-sev-p0">Route around: {plan.avoid.join(', ')}</p>
      )}

      <p className="mt-1 text-[11px] text-ops-faint">
        Capacity {plan.zone.capacity.toLocaleString('en-IN')} · chosen because every closer
        point sits inside the hazard radius.
      </p>

      <button
        type="button"
        onClick={() => onUseInstruction(plan.instruction)}
        className="mt-2.5 rounded-md border border-ops-accent/40 bg-ops-accent/10 px-3 py-1.5 text-[12px] font-medium text-ops-accent transition-colors hover:bg-ops-accent/20"
      >
        Load into broadcast
      </button>
    </section>
  )
}
