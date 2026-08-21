import type { Coordinates } from './types'

/**
 * SAFE WALK — a dead man's switch for walking home.
 *
 * You tell AEGIS where you are going and how long it should take. It asks you
 * to check in on the way. Miss enough check-ins, or overrun your ETA badly
 * enough, and it escalates on its own — because the situation this exists for
 * is precisely the one where you cannot reach for your phone.
 *
 * Escalation is *computed*, never scheduled. A `setTimeout` ladder silently
 * never fires on serverless, so overdue state is derived from timestamps on
 * every read — the same doctrine the SLA clock and alert escalation use.
 */

export type SafeWalkStatus = 'walking' | 'arrived' | 'cancelled' | 'escalated'

export interface SafeWalk {
  id: string
  startedAt: string
  destination: string
  /** How long the walker said it should take. */
  expectedMinutes: number
  lastCheckInAt: string
  status: SafeWalkStatus
  /** Breadcrumb trail, oldest first. */
  path: Coordinates[]
  /** Set when escalation fired, linking to the SENTINEL session it opened. */
  sentinelSessionId: string | null
  /** Trusted contacts notified alongside the control room. */
  trustedContacts: string[]
}

/** How often a walker is asked to confirm they are fine. */
export const CHECK_IN_INTERVAL_MS = 3 * 60 * 1000

/** Missed check-ins tolerated before escalation. Two, not one. */
export const MISSED_CHECK_INS_BEFORE_ESCALATION = 2

/**
 * Slack past the stated ETA before overrun alone escalates. People stop to
 * talk; a five-minute overrun is life, not an emergency.
 */
export const ETA_GRACE_MS = 5 * 60 * 1000

/**
 * When the next check-in is due.
 *
 * @example
 * nextCheckInDueAt(walk).toISOString()
 */
export function nextCheckInDueAt(walk: SafeWalk): Date {
  return new Date(new Date(walk.lastCheckInAt).getTime() + CHECK_IN_INTERVAL_MS)
}

/**
 * How many check-ins have been missed, as a whole number of elapsed intervals
 * since the last confirmed contact.
 *
 * @example
 * missedCheckIns(walk, now) // => 2
 */
export function missedCheckIns(walk: SafeWalk, now: Date): number {
  const silence = now.getTime() - new Date(walk.lastCheckInAt).getTime()
  return Math.max(0, Math.floor(silence / CHECK_IN_INTERVAL_MS))
}

/**
 * Whether the walker is past their stated arrival time plus grace.
 *
 * @example
 * isOverdue(walk, now) // => true
 */
export function isOverdue(walk: SafeWalk, now: Date): boolean {
  const dueAt = new Date(walk.startedAt).getTime() + walk.expectedMinutes * 60_000 + ETA_GRACE_MS
  return now.getTime() > dueAt
}

/**
 * Whether this walk should now raise a silent alarm.
 *
 * Two independent triggers, because they fail differently: a walker who has
 * stopped responding to check-ins may still be inside their ETA, and a walker
 * who is tapping "I'm fine" out of habit may still be badly overdue. Either
 * alone is enough.
 *
 * Only walks still in progress can escalate — an arrived or cancelled walk is
 * finished, and re-escalating it would page the control room forever.
 *
 * @example
 * shouldEscalate(walk, now) // => true after two missed check-ins
 */
export function shouldEscalate(walk: SafeWalk, now: Date): boolean {
  if (walk.status !== 'walking') return false
  return missedCheckIns(walk, now) >= MISSED_CHECK_INS_BEFORE_ESCALATION || isOverdue(walk, now)
}

/**
 * Why a walk escalated, in the words the control room and the trusted contact
 * both see. Written at escalation time so the record cannot drift later.
 *
 * @example
 * escalationReason(walk, now)
 * // => 'No check-in for 6 minutes while walking to Hostel 8.'
 */
export function escalationReason(walk: SafeWalk, now: Date): string {
  const silentMinutes = Math.floor(
    (now.getTime() - new Date(walk.lastCheckInAt).getTime()) / 60_000,
  )

  if (missedCheckIns(walk, now) >= MISSED_CHECK_INS_BEFORE_ESCALATION) {
    return `No check-in for ${silentMinutes} minutes while walking to ${walk.destination}.`
  }
  return `Overdue arriving at ${walk.destination} — expected within ${walk.expectedMinutes} minutes.`
}

/** Progress through the stated walk duration, clamped to 0–1 for a progress bar. */
export function walkProgress(walk: SafeWalk, now: Date): number {
  const elapsed = now.getTime() - new Date(walk.startedAt).getTime()
  return Math.min(1, Math.max(0, elapsed / (walk.expectedMinutes * 60_000)))
}
