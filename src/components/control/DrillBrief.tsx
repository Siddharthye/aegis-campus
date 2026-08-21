'use client'

import { useEffect, useState } from 'react'
import { formatClock, type DrillGrade, type DrillReport } from '@/domain/drill'
import { PrintButton } from './PrintButton'

const GRADE_NOTE: Record<DrillGrade, string> = {
  A: 'Every incident was resolved inside its response-time target.',
  B: 'Most incidents met their target. Review the exceptions below.',
  C: 'Half or more met their target. Response times need attention.',
  D: 'Most incidents breached their target. Escalate this to the safety committee.',
}

const clockOrDash = (ms: number | null) => (ms === null ? '—' : formatClock(ms))

const formatMoment = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', hour12: false })

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; report: DrillReport }
  | { kind: 'missing' }

/**
 * The printable after-action report.
 *
 * Reads the drill through `/api/drill/:id/report` rather than calling the
 * service directly, because page rendering and route handlers run as separate
 * serverless functions and therefore do not share the in-memory store — a
 * server component reading the store directly finds an empty one in
 * production. Going over HTTP is also what every other consumer does, so this
 * page proves the same API a buyer would integrate against.
 */
export function DrillBrief({ drillId }: { drillId: string }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    void fetch(`/api/drill/${encodeURIComponent(drillId)}/report`)
      .then(async (response) => {
        if (!response.ok) {
          setState({ kind: 'missing' })
          return
        }
        const body = (await response.json()) as { report: DrillReport }
        setState({ kind: 'ready', report: body.report })
      })
      .catch(() => setState({ kind: 'missing' }))
  }, [drillId])

  if (state.kind === 'loading') {
    return <p className="text-[13px] text-ops-muted">Loading after-action report…</p>
  }

  if (state.kind === 'missing') {
    return (
      <div className="rounded-lg border border-sev-p1/40 bg-sev-p1/5 p-5">
        <p className="ops-label text-sev-p1">No such drill</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ops-muted">
          Drill <span className="font-mono">{drillId}</span> was not found. It may have been
          cleared from the control room.
        </p>
      </div>
    )
  }

  const { report } = state

  return (
    <>
      <header className="flex flex-wrap items-start gap-4 border-b border-ops-border pb-5">
        <div>
          <p className="ops-label print-muted text-ops-accent">AEGIS · after-action report</p>
          <h1 className="print-ink mt-1.5 text-2xl font-bold tracking-tight">{report.scenario}</h1>
          <p className="print-muted mt-1 text-[12px] text-ops-muted">
            Drill {report.drillId} · started {formatMoment(report.startedAt)}
            {report.completedAt && ` · completed ${formatMoment(report.completedAt)}`}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <p className="ops-label print-muted text-ops-faint">Grade</p>
            <p className="print-ink font-mono text-4xl font-bold text-ops-accent">{report.grade}</p>
          </div>
          <PrintButton />
        </div>
      </header>

      <p className="print-ink mt-4 text-[13px] leading-relaxed text-ops-text">
        {GRADE_NOTE[report.grade]}
      </p>

      <section className="print-panel mt-5 grid grid-cols-2 gap-4 rounded-lg border border-ops-border p-4 sm:grid-cols-4">
        <Metric label="Incidents" value={String(report.slaTotal)} />
        <Metric label="Within SLA" value={`${report.slaMet}/${report.slaTotal}`} />
        <Metric label="Broadcasts" value={String(report.broadcasts)} />
        <Metric label="Duration" value={clockOrDash(report.durationMs)} />
      </section>

      <section className="mt-6">
        <h2 className="ops-label print-muted text-ops-muted">Incident detail</h2>

        <div className="overflow-x-auto">
          <table className="mt-2.5 w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-ops-border">
                {['Incident', 'Sev', 'Triage', 'Dispatch', 'Resolve', 'Target', 'Outcome'].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="ops-label print-muted py-1.5 pr-3 font-normal text-ops-faint"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {report.incidents.map((review) => (
                <tr key={review.incidentId} className="border-b border-ops-border/60">
                  <td className="print-ink py-2 pr-3 text-[12px] text-ops-text">{review.title}</td>
                  <td className="print-ink py-2 pr-3 font-mono text-[12px]">{review.severity}</td>
                  <td className="print-muted py-2 pr-3 font-mono text-[12px] text-ops-muted">
                    {clockOrDash(review.timeToTriageMs)}
                  </td>
                  <td className="print-muted py-2 pr-3 font-mono text-[12px] text-ops-muted">
                    {clockOrDash(review.timeToDispatchMs)}
                  </td>
                  <td className="print-muted py-2 pr-3 font-mono text-[12px] text-ops-muted">
                    {clockOrDash(review.timeToResolveMs)}
                  </td>
                  <td className="print-muted py-2 pr-3 font-mono text-[12px] text-ops-muted">
                    {review.slaTargetMinutes}m
                  </td>
                  <td
                    className={`print-ink py-2 font-mono text-[12px] ${
                      review.slaMet ? 'text-emerald-400' : 'text-sev-p0'
                    }`}
                  >
                    {review.slaMet ? 'Met' : 'Breached'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="print-muted mt-8 border-t border-ops-border pt-4 text-[11px] leading-relaxed text-ops-faint">
        Times are measured from the moment each report was received. Every figure is derived from
        the incident audit trail recorded during the drill, and can be reconciled against the
        control-room timeline for the same incident ids. Generated by AEGIS.
      </footer>
    </>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="ops-label print-muted text-ops-faint">{label}</p>
      <p className="print-ink mt-0.5 font-mono text-lg text-ops-text">{value}</p>
    </div>
  )
}
