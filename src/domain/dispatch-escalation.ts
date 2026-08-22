import type { Severity } from './types'

/**
 * Acknowledgement clocks and the escalation ladder — acquired from
 * DispatchGrid.
 *
 * AEGIS could already pick the right responder and clock the incident, but it
 * assumed that assigning someone meant they were on their way. DispatchGrid's
 * insight is that this is exactly the wrong assumption: a guard whose phone is
 * in a drawer looks identical to a guard running towards a fire, until the
 * clock runs out. Silence is a signal, and an unacknowledged assignment is an
 * active failure rather than a neutral state.
 *
 * Their engine is FastAPI over Postgres, so what is integrated is the rule
 * set — the bands, the deadlines and the ladder — expressed against AEGIS's
 * P0–P3 severities instead of their 0–100 score. Every function here is pure,
 * so the whole ladder is testable without a clock or a database.
 */

/** Who gets pulled in, in order, as an assignment goes unanswered. */
export const ESCALATION_LADDER = ['responder', 'supervisor', 'warden', 'chief'] as const

export type EscalationTier = (typeof ESCALATION_LADDER)[number]

export interface Deadlines {
  /** Seconds the responder has to acknowledge before the next tier is pulled. */
  ackSeconds: number
  /** Seconds to be on scene. */
  onSceneSeconds: number
  /** Seconds to resolve. */
  resolveSeconds: number
}

/**
 * DispatchGrid's four bands, mapped onto AEGIS severities.
 *
 * Their engine bands a 0–100 score; ours is already P0–P3, and the two line
 * up one to one — critical, high, medium, low — so the mapping is a rename
 * rather than a reinterpretation. The numbers are theirs, unchanged.
 */
const DEADLINES: Record<Severity, Deadlines> = {
  P0: { ackSeconds: 45, onSceneSeconds: 240, resolveSeconds: 1_800 },
  P1: { ackSeconds: 90, onSceneSeconds: 600, resolveSeconds: 3_600 },
  P2: { ackSeconds: 300, onSceneSeconds: 1_800, resolveSeconds: 14_400 },
  P3: { ackSeconds: 900, onSceneSeconds: 7_200, resolveSeconds: 86_400 },
}

/**
 * The clocks an assignment at this severity runs against.
 *
 * @example
 * deadlinesFor('P0').ackSeconds // => 45
 */
export function deadlinesFor(severity: Severity): Deadlines {
  return DEADLINES[severity]
}

/** The tier after this one, or null once the chief has been reached. */
export function nextTier(current: EscalationTier): EscalationTier | null {
  const index = ESCALATION_LADDER.indexOf(current)
  return ESCALATION_LADDER[index + 1] ?? null
}

export interface AssignmentState {
  severity: Severity
  /** When the responder was assigned. */
  assignedAt: string
  /** When they acknowledged, or null while they have not. */
  acknowledgedAt: string | null
  /** How far up the ladder this assignment has already been pushed. */
  tier: EscalationTier
}

export interface EscalationVerdict {
  /** Whether the clock has run out on this tier. */
  overdue: boolean
  /** Seconds past the acknowledgement deadline; negative while in time. */
  overdueBySeconds: number
  /** Who to pull in now, or null if nobody is left or nothing is wrong. */
  escalateTo: EscalationTier | null
  /** What a dispatcher should read on the board. */
  reason: string
}

/**
 * Whether an assignment has gone quiet long enough to escalate.
 *
 * Acknowledgement stops the clock permanently: once a responder has answered,
 * they are dealt with by the on-scene and resolve clocks the incident already
 * runs, not by this ladder. The ladder exists only for silence.
 *
 * @example
 * judgeAssignment({
 *   severity: 'P0',
 *   assignedAt: '2026-08-22T10:00:00Z',
 *   acknowledgedAt: null,
 *   tier: 'responder',
 * }, new Date('2026-08-22T10:01:00Z'))
 * // => overdue, escalate to 'supervisor'
 */
export function judgeAssignment(
  assignment: AssignmentState,
  now: Date,
): EscalationVerdict {
  const { ackSeconds } = deadlinesFor(assignment.severity)

  if (assignment.acknowledgedAt) {
    return {
      overdue: false,
      overdueBySeconds: 0,
      escalateTo: null,
      reason: 'Acknowledged — the responder answered.',
    }
  }

  const elapsed = (now.getTime() - new Date(assignment.assignedAt).getTime()) / 1_000
  const overdueBySeconds = Math.round(elapsed - ackSeconds)

  if (overdueBySeconds < 0) {
    return {
      overdue: false,
      overdueBySeconds,
      escalateTo: null,
      reason: `Waiting on acknowledgement — ${Math.abs(overdueBySeconds)}s left.`,
    }
  }

  const escalateTo = nextTier(assignment.tier)

  return {
    overdue: true,
    overdueBySeconds,
    escalateTo,
    reason: escalateTo
      ? `No acknowledgement after ${ackSeconds}s — pulling in the ${escalateTo}.`
      : `No acknowledgement after ${ackSeconds}s, and the ladder is exhausted. Escalate by phone.`,
  }
}

/**
 * Harassment routing, which DispatchGrid treats as a hard filter rather than
 * a preference — and it is right to. A survivor who asked for a counsellor
 * and got whoever was nearest has been failed by the dispatch, however fast
 * it was.
 */
export function requiresSpecialistRouting(category: string): boolean {
  return category === 'harassment'
}
