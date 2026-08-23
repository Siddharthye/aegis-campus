import type { Coordinates, Incident, IncidentCategory, Severity } from './types'

/**
 * What a student on campus actually receives.
 *
 * A broadcast is not a new record — it is a line already written into the
 * incident's timeline by the control room. Deriving alerts from that rather
 * than storing them twice means the feed can never disagree with the audit
 * trail, which is the one place the truth of "what was said, and when" has to
 * live.
 *
 * Everything here is pure so the receiver can be tested without a network,
 * and so the same logic can run from cached incidents when there is none.
 */

export interface CampusAlert {
  /** Stable across refreshes: one incident may be broadcast more than once. */
  id: string
  incidentId: string
  message: string
  severity: Severity
  /** Drives the safety guidance shown beneath the alert. */
  category: IncidentCategory
  /** Where the incident is, as the control room labelled it. */
  place: string
  /** The hazard itself, so a reader can be routed away from it. */
  at: Coordinates
  sentAt: string
}

/**
 * Every broadcast the control room has sent, newest first.
 *
 * @example
 * alertsFrom(incidents)[0].message // => the most recent thing said to campus
 */
export function alertsFrom(incidents: readonly Incident[]): CampusAlert[] {
  const alerts: CampusAlert[] = []

  for (const incident of incidents) {
    // Drills are excluded: a rehearsal must never reach a student's phone
    // looking exactly like a real evacuation order.
    if (incident.isDrill) continue

    for (const [index, entry] of incident.timeline.entries()) {
      if (entry.action !== 'broadcast' || !entry.detail) continue

      alerts.push({
        id: `${incident.id}:${index}`,
        incidentId: incident.id,
        message: entry.detail,
        severity: incident.severity,
        category: incident.category,
        place: incident.location.label.split(' · ')[0],
        at: { lat: incident.location.lat, lng: incident.location.lng },
        sentAt: entry.at,
      })
    }
  }

  return alerts.sort((a, b) => b.sentAt.localeCompare(a.sentAt))
}

/** Alerts sent recently enough to still be acted on. */
export const ALERT_FRESH_MS = 6 * 60 * 60 * 1000

/**
 * Whether an alert is still current.
 *
 * An evacuation order from yesterday is history, not an instruction, and
 * showing it at the top of a student's screen would be actively misleading.
 */
export function isCurrent(alert: CampusAlert, now: Date): boolean {
  return now.getTime() - Date.parse(alert.sentAt) < ALERT_FRESH_MS
}

/**
 * How long ago, in the words someone reads at a glance.
 *
 * @example
 * describeAge('2026-08-23T10:00:00Z', new Date('2026-08-23T10:00:30Z')) // => 'just now'
 */
export function describeAge(sentAt: string, now: Date): string {
  const seconds = Math.max(0, Math.round((now.getTime() - Date.parse(sentAt)) / 1000))
  if (seconds < 45) return 'just now'

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`

  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}
