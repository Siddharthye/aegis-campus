'use client'

import { describeSlaClock, type QueueEntry } from '@/domain/queue'
import { SeverityBadge } from '@/components/ops/SeverityBadge'
import { StatusBadge } from '@/components/ops/StatusBadge'

interface IncidentQueueProps {
  entries: QueueEntry[]
  selectedId: string | null
  onSelect: (incidentId: string) => void
}

/**
 * The dispatcher queue, ordered by SLA pressure rather than arrival time.
 * Each row is a decision: what it is, where it is, and how long is left.
 */
export function IncidentQueue({ entries, selectedId, onSelect }: IncidentQueueProps) {
  if (entries.length === 0) {
    return (
      <div className="px-3 py-8 text-center">
        <p className="ops-label text-emerald-400">Board clear</p>
        <p className="mt-1.5 text-[12px] text-ops-muted">
          No open incidents. Every SLA clock is stopped.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-1">
      {entries.map(({ incident, breached, minutesRemaining }) => {
        const isSelected = incident.id === selectedId

        return (
          <li key={incident.id}>
            <button
              type="button"
              onClick={() => onSelect(incident.id)}
              aria-current={isSelected}
              className={`w-full rounded-lg p-2.5 text-left transition-colors ${
                isSelected
                  ? 'bg-ops-accent/12 ring-1 ring-inset ring-ops-accent/40'
                  : 'hover:bg-ops-lift/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <SeverityBadge severity={incident.severity} compact />
                <StatusBadge status={incident.status} />
                {incident.isDrill && <span className="ops-label text-ops-faint">DRILL</span>}
                <span
                  className={`ops-label ml-auto ${
                    breached ? 'siren-pulse text-sev-p0' : 'text-ops-muted'
                  }`}
                >
                  {describeSlaClock(minutesRemaining)}
                </span>
              </div>

              <p className="mt-1.5 truncate text-[13px] font-medium text-ops-text">
                {incident.title}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-ops-muted">
                {incident.location.label}
                {incident.reportCount > 1 && ` · ${incident.reportCount} reports`}
              </p>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
