import type { ArrivalEstimate } from '@/domain/dispatch'
import type { Incident, IncidentStatus } from '@/domain/types'
import { SeverityBadge } from '@/components/ops/SeverityBadge'
import { StatusBadge } from '@/components/ops/StatusBadge'
import { MiniBar, Panel, Stat } from '@/components/ui/Panel'
import { SlaClock } from './SlaClock'

/** The advance a responder can make from each status, and its button label. */
const NEXT_ACTION: Partial<Record<IncidentStatus, { status: IncidentStatus; label: string }>> = {
  dispatched: { status: 'on-scene', label: 'Arrived on scene' },
  'on-scene': { status: 'resolved', label: 'Mark resolved' },
}

/** Distance at which the closing bar reads as full. */
const CLOSING_RANGE_M = 400

interface ActiveAssignmentProps {
  incident: Incident
  now: Date
  /** Live position, or null when tracking has nothing to report yet. */
  arrival: ArrivalEstimate | null
  onAdvance: (status: IncidentStatus) => void
}

/**
 * The one thing that matters when a responder has work.
 *
 * Everything here answers a question asked while walking: where am I going,
 * how far, how sure are we, and what do I press when I get there. The single
 * action button is deliberately the width of the panel — it is pressed with a
 * thumb, outdoors, in a hurry.
 */
export function ActiveAssignment({ incident, now, arrival, onAdvance }: ActiveAssignmentProps) {
  const action = NEXT_ACTION[incident.status]

  return (
    <Panel
      label="Active assignment"
      tone="accent"
      spotlight
      aside={
        <>
          <SeverityBadge severity={incident.severity} compact />
          <StatusBadge status={incident.status} />
        </>
      }
    >
      <div className="p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-xl font-bold tracking-tight text-ops-text">{incident.title}</h2>
          <SlaClock incident={incident} now={now} />
        </div>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ops-muted">
          {incident.description}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Stat value={arrival ? `${arrival.distanceM}m` : '—'} label="distance" tone="accent" />
          <Stat value={arrival ? `${arrival.etaMinutes}m` : '—'} label="eta" tone="accent" />
          <Stat value={incident.reportCount} label="reports" />
          <Stat
            value={`${Math.round(incident.confidence * 100)}%`}
            label="confidence"
            tone={incident.confidence > 0.8 ? 'good' : 'default'}
          />
        </div>

        <div className="mt-4 rounded-xl border border-ops-accent/30 bg-ops-accent/5 p-4">
          <p className="ops-label text-ops-accent">Go to</p>
          <p className="mt-1 text-[15px] font-medium text-ops-text">{incident.location.label}</p>
          <p className="mt-0.5 font-mono text-[11px] text-ops-muted">
            {Math.round(incident.location.confidence * 100)}% · {incident.location.method}
            {incident.location.floor !== undefined && ` · floor ${incident.location.floor}`}
          </p>

          {/* Only while still approaching — a closing bar after arrival is
              telling someone something they can see with their own eyes. */}
          {arrival && incident.status !== 'on-scene' && (
            <div className="mt-3">
              <MiniBar value={Math.max(0, CLOSING_RANGE_M - arrival.distanceM)} max={CLOSING_RANGE_M} />
              <p className="ops-label mt-1.5 flex items-center gap-1.5 text-ops-accent">
                <span className="siren-pulse size-1.5 rounded-full bg-current" />
                closing · {arrival.distanceM}m out
              </p>
            </div>
          )}
        </div>

        {action && (
          <button
            type="button"
            onClick={() => onAdvance(action.status)}
            className="mt-4 w-full rounded-xl border border-ops-accent/40 bg-ops-accent/10 py-4 text-[15px] font-semibold text-ops-accent transition-colors hover:bg-ops-accent/20 active:scale-[0.99]"
          >
            {action.label}
          </button>
        )}
      </div>
    </Panel>
  )
}
