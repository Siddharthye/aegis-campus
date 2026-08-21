'use client'

import { formatTime, useLiveClock } from './use-live-clock'

/**
 * The reader's own clock, ticking, in the header of every ops screen.
 *
 * It reads the device rather than the server on purpose: this is deployed to
 * Vercel, which runs in UTC, and a dispatcher in Bhubaneswar working an SLA
 * against a clock five and a half hours off their own would be worse than no
 * clock at all.
 */
export function LiveClock() {
  const now = useLiveClock()

  return (
    <span
      className="ops-label flex items-center gap-2 rounded-md border border-ops-border bg-ops-panel px-2.5 py-1.5 text-ops-muted"
      title="Local time on this device"
    >
      <span className="siren-pulse size-1.5 rounded-full bg-emerald-400" />
      <time
        className="font-mono tabular-nums text-ops-text"
        dateTime={now?.toISOString()}
        suppressHydrationWarning
      >
        {formatTime(now)}
      </time>
    </span>
  )
}
