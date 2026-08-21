import type { TimelineEntry } from '@/domain/types'

/** Actions that deserve visual weight in the trail. */
const EMPHASISED_ACTIONS = new Set(['escalated', 'broadcast', 'resolved'])

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/**
 * The incident audit trail: every transition, timestamped and attributed.
 *
 * This is the compliance artifact as much as a UI — it is what the
 * after-action report is computed from, and what we point at when a judge asks
 * how an incident became a P0.
 */
export function IncidentTimeline({ entries }: { entries: readonly TimelineEntry[] }) {
  return (
    <section className="rounded-lg border border-ops-border bg-ops-panel p-4">
      <p className="ops-label text-ops-muted">Timeline</p>

      <ol className="mt-2.5 flex flex-col gap-2.5">
        {entries.map((entry, index) => (
          <li key={`${entry.at}-${index}`} className="flex gap-3">
            <span className="ops-label w-16 shrink-0 pt-0.5 text-ops-faint">
              {formatTime(entry.at)}
            </span>

            <span
              className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                EMPHASISED_ACTIONS.has(entry.action) ? 'bg-ops-accent' : 'bg-ops-border'
              }`}
            />

            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-ops-text">
                <span className="font-medium">{entry.action}</span>
                <span className="ml-1.5 text-ops-faint">{entry.actor}</span>
              </p>
              {entry.detail && (
                <p className="mt-0.5 text-[11px] leading-relaxed text-ops-muted">{entry.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
