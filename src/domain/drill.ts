/**
 * DRILL — deterministic emergency-drill playback. Pure data and pure
 * functions only: the service layer owns I/O, this file owns the rules for
 * which step runs next, which incident a step targets, and how a finished
 * drill is graded. Determinism is the point — a drill must land the same way
 * on stage as it did at 3am the night before.
 */
import { readSla } from './sla'
import type {
  Incident,
  IncidentCategory,
  IncidentStatus,
  LocatedPosition,
  Severity,
  TimelineEntry,
} from './types'

export type DrillScenarioId = 'blockc-fire' | 'library-medical'

/**
 * One scripted beat of a scenario. `afterMs` is measured from drill start and
 * must be non-decreasing within a scenario, so playback is a single cursor.
 * Steps without an explicit target act on the most recently created
 * unresolved drill incident — see {@link pickDrillTarget}.
 */
export type DrillStep =
  | {
      kind: 'report'
      afterMs: number
      category: IncidentCategory
      severity: Severity
      title: string
      description: string
      location: LocatedPosition
    }
  | { kind: 'fuse'; afterMs: number; reports: number; confidence: number }
  | { kind: 'dispatch'; afterMs: number }
  | { kind: 'advance'; afterMs: number; status: IncidentStatus }
  | { kind: 'broadcast'; afterMs: number; message: string }
  | { kind: 'resolve'; afterMs: number }

export interface DrillScenario {
  id: DrillScenarioId
  name: string
  description: string
  steps: readonly DrillStep[]
}

/** Persisted playback state for one running (or finished) drill. */
export interface DrillRun {
  id: string
  scenario: DrillScenarioId
  startedAt: string
  /** Playback multiplier. 2 runs a 90-second scenario in 45 seconds. */
  speed: number
  /** Steps already executed — the playback cursor. */
  executedSteps: number
  /** Incidents this run created, in creation order. */
  incidentIds: string[]
  done: boolean
  completedAt: string | null
}

/**
 * Total scripted length of a scenario — the offset of its final step.
 *
 * @example
 * scenarioDurationMs([{ kind: 'resolve', afterMs: 30_000 }]) // => 30000
 */
export function scenarioDurationMs(steps: readonly DrillStep[]): number {
  return steps.length === 0 ? 0 : steps[steps.length - 1].afterMs
}

/**
 * Milliseconds until the next unexecuted step is due, or null when the
 * scenario is exhausted. Never negative — an overdue step is due "now".
 *
 * @example
 * nextStepDelayMs(steps, 2, 4_000) // => 1000 when steps[2].afterMs is 5000
 */
export function nextStepDelayMs(
  steps: readonly DrillStep[],
  executedSteps: number,
  elapsedMs: number,
): number | null {
  if (executedSteps >= steps.length) return null
  return Math.max(0, steps[executedSteps].afterMs - elapsedMs)
}

/**
 * The incident a targetless step acts on: the most recently created
 * unresolved incident belonging to this run. Returns null when every drill
 * incident is resolved — callers treat that as a safe no-op, which is what
 * lets scenarios end with epilogue broadcasts.
 *
 * @example
 * pickDrillTarget(incidents, run.incidentIds)?.id // => 'inc-4f9a12c0'
 */
export function pickDrillTarget(
  incidents: readonly Incident[],
  incidentIds: readonly string[],
): Incident | null {
  const open = incidents.filter(
    (incident) => incidentIds.includes(incident.id) && incident.status !== 'resolved',
  )
  if (open.length === 0) return null
  return [...open].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

export type DrillGrade = 'A' | 'B' | 'C' | 'D'

/**
 * Letter grade from SLA adherence: A is a clean sweep, D is under half.
 *
 * @example
 * gradeFromSla(2, 2) // => 'A'
 */
export function gradeFromSla(met: number, total: number): DrillGrade {
  if (total === 0) return 'D'
  const ratio = met / total
  if (ratio >= 1) return 'A'
  if (ratio >= 0.75) return 'B'
  if (ratio >= 0.5) return 'C'
  return 'D'
}

/** Per-incident after-action metrics, all measured from `createdAt`. */
export interface DrillIncidentReview {
  incidentId: string
  title: string
  severity: Severity
  timeToTriageMs: number | null
  timeToDispatchMs: number | null
  timeToResolveMs: number | null
  slaTargetMinutes: number
  slaMet: boolean
}

export interface DrillReport {
  drillId: string
  scenario: DrillScenarioId
  startedAt: string
  completedAt: string | null
  durationMs: number | null
  incidents: DrillIncidentReview[]
  slaMet: number
  slaTotal: number
  broadcasts: number
  dispatchAcks: number
  grade: DrillGrade
}

const firstEntryOffsetMs = (
  timeline: readonly TimelineEntry[],
  createdAt: string,
  actions: readonly string[],
): number | null => {
  const entry = timeline.find((item) => actions.includes(item.action))
  if (!entry) return null
  return Math.max(0, new Date(entry.at).getTime() - new Date(createdAt).getTime())
}

/**
 * After-action report computed purely from the drill incidents' timelines —
 * the same audit trail the control room shows, so the numbers are defensible.
 *
 * @example
 * buildDrillReport(run, drillIncidents, new Date()).grade // => 'A'
 */
export function buildDrillReport(
  run: DrillRun,
  incidents: readonly Incident[],
  now: Date,
): DrillReport {
  const reviews = incidents.map((incident): DrillIncidentReview => {
    const sla = readSla(incident, now)
    return {
      incidentId: incident.id,
      title: incident.title,
      severity: incident.severity,
      timeToTriageMs: firstEntryOffsetMs(incident.timeline, incident.createdAt, ['corroborated', 'triaged']),
      timeToDispatchMs: firstEntryOffsetMs(incident.timeline, incident.createdAt, ['dispatched']),
      timeToResolveMs:
        incident.resolvedAt === null
          ? null
          : new Date(incident.resolvedAt).getTime() - new Date(incident.createdAt).getTime(),
      slaTargetMinutes: sla.targetMinutes,
      slaMet: incident.resolvedAt !== null && !sla.breached,
    }
  })

  const slaMet = reviews.filter((review) => review.slaMet).length
  const countActions = (action: string) =>
    incidents.reduce(
      (sum, incident) => sum + incident.timeline.filter((entry) => entry.action === action).length,
      0,
    )

  return {
    drillId: run.id,
    scenario: run.scenario,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    durationMs:
      run.completedAt === null
        ? null
        : new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime(),
    incidents: reviews,
    slaMet,
    slaTotal: reviews.length,
    broadcasts: countActions('broadcast'),
    dispatchAcks: countActions('dispatched'),
    grade: gradeFromSla(slaMet, reviews.length),
  }
}

/**
 * mm:ss clock string for a millisecond duration. Negative input clamps to 00:00.
 *
 * @example
 * formatClock(83_000) // => '01:23'
 */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
