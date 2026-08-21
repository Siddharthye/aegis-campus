import type { Severity } from './types'

/**
 * Corroboration → severity. The rule behind the claim that fifty reports of
 * one fire become one P0 incident without a human touching it: when many
 * distinct people report the same thing and the fusion confidence is high,
 * the incident escalates on its own.
 *
 * Pure and separate from the drill engine on purpose — this is a live
 * production rule that the drill merely exercises.
 */

/** Severity order, least to most urgent. Index arithmetic relies on this. */
const SEVERITY_LADDER: readonly Severity[] = ['P3', 'P2', 'P1', 'P0']

/**
 * The escalation floor a given corroboration level justifies. Thresholds are
 * deliberately conservative: a handful of reports is a coincidence, twenty
 * corroborated reports is a real event.
 */
const ESCALATION_THRESHOLDS: readonly { minReports: number; minConfidence: number; floor: Severity }[] = [
  { minReports: 20, minConfidence: 0.9, floor: 'P0' },
  { minReports: 10, minConfidence: 0.8, floor: 'P1' },
  { minReports: 5, minConfidence: 0.7, floor: 'P2' },
]

/**
 * The more urgent of two severities.
 *
 * Used when an external engine (the FUSION module) and our own corroboration
 * rule disagree: we take whichever is more alarming rather than picking a
 * winner, because under-alerting is the expensive error.
 *
 * @example
 * moreUrgentSeverity('P2', 'P0') // => 'P0'
 */
export function moreUrgentSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_LADDER.indexOf(a) >= SEVERITY_LADDER.indexOf(b) ? a : b
}

/**
 * The most urgent severity justified by this corroboration level, or the
 * current severity when nothing justifies a bump.
 *
 * Escalation is one-way: corroboration can raise an incident's severity but
 * never lower it, because a dispatcher who has already escalated by hand must
 * not be silently overruled by arriving duplicates.
 *
 * @example
 * severityFromCorroboration('P2', 21, 0.96) // => 'P0'
 * severityFromCorroboration('P0', 1, 0.5)   // => 'P0' (never de-escalates)
 */
export function severityFromCorroboration(
  current: Severity,
  reportCount: number,
  confidence: number,
): Severity {
  const match = ESCALATION_THRESHOLDS.find(
    (threshold) => reportCount >= threshold.minReports && confidence >= threshold.minConfidence,
  )
  if (!match) return current

  const currentRank = SEVERITY_LADDER.indexOf(current)
  const floorRank = SEVERITY_LADDER.indexOf(match.floor)
  return floorRank > currentRank ? match.floor : current
}

/**
 * Human-readable justification for an escalation, for the incident timeline
 * and for answering "why did this become a P0?" in front of a panel.
 *
 * @example
 * escalationRationale(21, 0.96)
 * // => '21 corroborating reports at 96% confidence'
 */
export function escalationRationale(reportCount: number, confidence: number): string {
  return `${reportCount} corroborating reports at ${Math.round(confidence * 100)}% confidence`
}
