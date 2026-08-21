import type { Severity } from '@/domain/types'

const SEVERITY_STYLES: Record<Severity, { label: string; className: string }> = {
  P0: { label: 'P0 · CRITICAL', className: 'bg-sev-p0/15 text-sev-p0 border-sev-p0/40' },
  P1: { label: 'P1 · HIGH', className: 'bg-sev-p1/15 text-sev-p1 border-sev-p1/40' },
  P2: { label: 'P2 · MEDIUM', className: 'bg-sev-p2/15 text-sev-p2 border-sev-p2/40' },
  P3: { label: 'P3 · INFO', className: 'bg-sev-p3/15 text-sev-p3 border-sev-p3/40' },
}

export function SeverityBadge({ severity, compact = false }: { severity: Severity; compact?: boolean }) {
  const { label, className } = SEVERITY_STYLES[severity]

  return (
    <span
      className={`ops-label inline-flex shrink-0 items-center rounded border px-2 py-0.5 ${className}`}
    >
      {compact ? severity : label}
    </span>
  )
}
