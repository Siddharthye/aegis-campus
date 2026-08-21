import { notFound } from 'next/navigation'
import { formatClock, type DrillGrade } from '@/domain/drill'
import { findScenario } from '@/data/scenarios'
import { getDrillAfterAction } from '@/lib/drill-service'
import { PrintButton } from '@/components/control/PrintButton'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Drill After-Action Report — AEGIS' }

type PageProps = { params: Promise<{ id: string }> }

const GRADE_NOTE: Record<DrillGrade, string> = {
  A: 'Every incident was resolved inside its response-time target.',
  B: 'Most incidents met their target. Review the exceptions below.',
  C: 'Half or more met their target. Response times need attention.',
  D: 'Most incidents breached their target. Escalate this to the safety committee.',
}

const clockOrDash = (ms: number | null) => (ms === null ? '—' : formatClock(ms))

const formatMoment = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
  })

/**
 * The printable after-action report.
 *
 * Campuses are legally required to run and measure evacuation drills, and the
 * artifact that satisfies that requirement is a document someone can file —
 * not a dashboard. The browser's own print-to-PDF produces it, so there is no
 * PDF library to install and nothing native to fail on a buyer's machine.
 *
 * Every figure is derived from the incident timelines the control room already
 * shows, so this document cannot disagree with the live system.
 */
export default async function DrillBriefPage({ params }: PageProps) {
  const { id } = await params
  const report = await getDrillAfterAction(id)
  if (!report) notFound()

  const scenario = findScenario(report.scenario)

  return (
    <main className="print-sheet mx-auto max-w-3xl px-6 py-10">
      <header className="flex flex-wrap items-start gap-4 border-b border-ops-border pb-5">
        <div>
          <p className="ops-label print-muted text-ops-accent">AEGIS · after-action report</p>
          <h1 className="print-ink mt-1.5 text-2xl font-bold tracking-tight">
            {scenario?.name ?? report.scenario}
          </h1>
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

      <section className="print-panel mt-5 grid grid-cols-4 gap-4 rounded-lg border border-ops-border p-4">
        <Metric label="Incidents" value={String(report.slaTotal)} />
        <Metric label="Within SLA" value={`${report.slaMet}/${report.slaTotal}`} />
        <Metric label="Broadcasts" value={String(report.broadcasts)} />
        <Metric label="Duration" value={clockOrDash(report.durationMs)} />
      </section>

      <section className="mt-6">
        <h2 className="ops-label print-muted text-ops-muted">Incident detail</h2>

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
      </section>

      <footer className="print-muted mt-8 border-t border-ops-border pt-4 text-[11px] leading-relaxed text-ops-faint">
        Times are measured from the moment each report was received. Every figure is derived from
        the incident audit trail recorded during the drill, and can be reconciled against the
        control-room timeline for the same incident ids. Generated by AEGIS.
      </footer>
    </main>
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
