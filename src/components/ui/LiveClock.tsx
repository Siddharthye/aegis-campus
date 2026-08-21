'use client'

import { describeIdentity, useIdentity } from '@/lib/identity'
import { formatDate, formatTime, useLiveClock } from './use-live-clock'

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
  const identity = useIdentity()

  return (
    <span className="ops-label flex flex-wrap items-center gap-2">
      {identity && (
        <span
          className="flex items-center gap-2 rounded-md border border-ops-accent/25 bg-ops-accent/10 px-2.5 py-1.5 text-ops-accent"
          title="Everything you file is attributed to this"
        >
          {describeIdentity(identity)}
        </span>
      )}
      <span
      className="flex items-center gap-2 rounded-md border border-ops-border bg-ops-panel px-2.5 py-1.5 text-ops-muted"
      title="Local time on this device"
    >
      <span className="siren-pulse size-1.5 rounded-full bg-emerald-400" />
      <time
        className="flex items-baseline gap-2 font-mono tabular-nums"
        dateTime={now?.toISOString()}
        suppressHydrationWarning
      >
        <span className="text-ops-faint">{formatDate(now)}</span>
        <span className="text-ops-text">{formatTime(now)}</span>
      </time>
      </span>
    </span>
  )
}
