import { formatClock, type DrillGrade, type DrillReport } from '@/domain/drill'

const GRADE_STYLES: Record<DrillGrade, string> = {
  A: 'text-emerald-400 border-emerald-400/40',
  B: 'text-sev-p3 border-sev-p3/40',
  C: 'text-sev-p2 border-sev-p2/40',
  D: 'text-sev-p0 border-sev-p0/40',
}

/** Durations that were never reached read as a dash, never as 00:00. */
const clockOrDash = (ms: number | null): string => (ms === null ? '—' : formatClock(ms))

/**
 * The graded after-action report — the closing beat of a drill.
 *
 * Campuses are legally required to run and measure evacuation drills, so this
 * is a compliance artifact, not demo scaffolding. Every figure is derived from
 * the incident timelines the control room already shows.
 */
export function AfterActionReport({ report }: { report: DrillReport }) {
  return (
    <div className="mt-3 rounded-lg border border-ops-border bg-ops-bg p-3">
      <div className="flex items-center gap-2">
        <p className="ops-label text-ops-muted">After-action report</p>
        <span
          className={`ops-label ml-auto rounded border px-2 py-0.5 ${GRADE_STYLES[report.grade]}`}
        >
          Grade {report.grade}
        </span>
      </div>

      <dl className="mt-2.5 grid grid-cols-3 gap-2 border-y border-ops-border py-2.5">
        <Metric label="SLA met" value={`${report.slaMet}/${report.slaTotal}`} />
        <Metric label="Broadcasts" value={String(report.broadcasts)} />
        <Metric label="Duration" value={clockOrDash(report.durationMs)} />
      </dl>

      <a
        href={`/drill/${report.drillId}/brief`}
        target="_blank"
        rel="noreferrer"
        className="mt-2.5 inline-block rounded-md border border-ops-accent/40 bg-ops-accent/10 px-2.5 py-1 text-[11px] font-medium text-ops-accent transition-colors hover:bg-ops-accent/20"
      >
        Open printable report →
      </a>

      <ul className="mt-2.5 flex flex-col gap-2">
        {report.incidents.map((review) => (
          <li key={review.incidentId}>
            <p className="truncate text-[12px] text-ops-text">
              <span className="font-mono text-ops-faint">{review.severity}</span> {review.title}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-ops-muted">
              triage {clockOrDash(review.timeToTriageMs)} · dispatch{' '}
              {clockOrDash(review.timeToDispatchMs)} · resolve{' '}
              {clockOrDash(review.timeToResolveMs)}
              <span className={review.slaMet ? 'ml-1.5 text-emerald-400' : 'ml-1.5 text-sev-p0'}>
                {review.slaMet ? 'within SLA' : 'SLA breached'}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="ops-label text-ops-faint">{label}</dt>
      <dd className="mt-0.5 font-mono text-[13px] text-ops-text">{value}</dd>
    </div>
  )
}
