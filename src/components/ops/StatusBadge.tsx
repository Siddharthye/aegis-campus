import type { IncidentStatus } from '@/domain/types'

const STATUS_STYLES: Record<IncidentStatus, string> = {
  reported: 'text-ops-muted border-ops-border',
  triaged: 'text-sev-p2 border-sev-p2/40',
  dispatched: 'text-ops-accent border-ops-accent/40',
  'on-scene': 'text-sev-p1 border-sev-p1/40',
  resolved: 'text-emerald-400 border-emerald-400/40',
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <span className={`ops-label inline-flex shrink-0 items-center rounded border px-2 py-0.5 ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  )
}
