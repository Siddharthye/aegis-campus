import type { Incident, Severity } from './types'

/** Response-time targets per severity, in minutes. The SLA clock everyone sees. */
export const SLA_TARGET_MINUTES: Record<Severity, number> = {
  P0: 5,
  P1: 10,
  P2: 30,
  P3: 120,
}

export interface SlaReading {
  targetMinutes: number
  elapsedMinutes: number
  remainingMinutes: number
  breached: boolean
}

/**
 * Where an incident stands against its SLA clock. For resolved incidents the
 * clock stops at resolution time; for open ones it keeps running.
 *
 * @example
 * readSla(incident, new Date())
 * // => { targetMinutes: 5, elapsedMinutes: 3.2, remainingMinutes: 1.8, breached: false }
 */
export function readSla(incident: Incident, now: Date): SlaReading {
  const targetMinutes = SLA_TARGET_MINUTES[incident.severity]
  const stoppedAt = incident.resolvedAt ? new Date(incident.resolvedAt) : now
  const elapsedMinutes = (stoppedAt.getTime() - new Date(incident.createdAt).getTime()) / 60_000

  return {
    targetMinutes,
    elapsedMinutes: Math.max(0, elapsedMinutes),
    remainingMinutes: targetMinutes - elapsedMinutes,
    breached: elapsedMinutes > targetMinutes,
  }
}
