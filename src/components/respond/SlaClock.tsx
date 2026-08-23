import { describeSlaClock } from '@/domain/queue'
import { readSla } from '@/domain/sla'
import type { Incident } from '@/domain/types'

/**
 * Time left against the promise made for this severity.
 *
 * Pulses once it is breached rather than simply turning red: a responder
 * glancing at a phone mid-stride catches movement long before they catch a
 * colour.
 */
export function SlaClock({ incident, now }: { incident: Incident; now: Date }) {
  const sla = readSla(incident, now)

  return (
    <span className={`ops-label ${sla.breached ? 'siren-pulse text-sev-p0' : 'text-ops-muted'}`}>
      {describeSlaClock(sla.remainingMinutes)}
    </span>
  )
}
