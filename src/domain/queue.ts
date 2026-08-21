import { readSla } from './sla'
import type { Incident, Severity } from './types'

/**
 * How the dispatcher queue is ordered.
 *
 * Sorting by severity alone starves the P2 that has been waiting an hour;
 * sorting by age alone buries a P0 that arrived thirty seconds ago. The queue
 * therefore ranks by *SLA pressure*: how far through its own clock each
 * incident is, weighted by what a breach at that severity costs.
 */

/** What a breach costs, relative to each other. A P0 breach is not a P3 breach. */
const SEVERITY_WEIGHT: Record<Severity, number> = { P0: 1000, P1: 100, P2: 10, P3: 1 }

/** Pressure at which an incident is treated as breaching, not merely late. */
const BREACH_PRESSURE = 1

export interface QueueEntry {
  incident: Incident
  /** Fraction of the SLA target consumed. 1 is exactly at target. */
  pressure: number
  /** Ranking score. Higher is more urgent. */
  score: number
  breached: boolean
  minutesRemaining: number
}

/**
 * Open incidents ordered by how urgently they need a dispatcher, most urgent
 * first. Resolved incidents are excluded — they need nothing.
 *
 * Score is `severityWeight × (1 + pressure)`, so severity dominates the
 * ordering while time still moves an incident up within and, once badly
 * overdue, across its band. That is the behaviour a dispatcher expects: a P0
 * always outranks a P1, but a P1 at triple its target outranks a fresh P1.
 *
 * @example
 * rankByPressure(incidents, new Date())[0].incident.severity // => 'P0'
 */
export function rankByPressure(incidents: readonly Incident[], now: Date): QueueEntry[] {
  return incidents
    .filter((incident) => incident.status !== 'resolved')
    .map((incident): QueueEntry => {
      const sla = readSla(incident, now)
      const pressure = sla.elapsedMinutes / sla.targetMinutes
      return {
        incident,
        pressure,
        score: SEVERITY_WEIGHT[incident.severity] * (1 + pressure),
        breached: pressure > BREACH_PRESSURE,
        minutesRemaining: sla.remainingMinutes,
      }
    })
    .sort((a, b) => b.score - a.score)
}

/**
 * A short human phrase for an SLA clock, for the queue row and the responder
 * screen. Negative remaining time reads as overdue, not as a negative number.
 *
 * @example
 * describeSlaClock(1.8)  // => '1m left'
 * describeSlaClock(-4.2) // => '4m overdue'
 */
export function describeSlaClock(minutesRemaining: number): string {
  const magnitude = Math.abs(minutesRemaining)
  const rounded = magnitude < 1 ? magnitude.toFixed(1) : String(Math.round(magnitude))
  return minutesRemaining < 0 ? `${rounded}m overdue` : `${rounded}m left`
}
