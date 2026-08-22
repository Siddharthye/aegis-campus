import type { Severity } from './types'

/**
 * Medical red-flag triage — acquired from VitalPath.
 *
 * AEGIS asks a reporter to pick a category and describe what happened. For a
 * medical emergency that is the wrong shape: "describe what happened" is a
 * box a frightened nineteen-year-old fills with *"pls come fast"*, which tells
 * a duty officer nothing about how fast is fast enough.
 *
 * VitalPath asks four structured questions instead — responsive, breathing,
 * bleeding, how many people — and separates "someone fainted and is sitting
 * up" from "someone is unresponsive and not breathing" in about eight seconds,
 * without asking anyone to name a symptom they do not know the word for.
 *
 * This does not diagnose anyone. It decides how fast someone should be reached
 * and who should reach them.
 *
 * Their service is FastAPI, so the cascade is ported rather than called. Every
 * rule and every threshold below is theirs.
 */

export type Breathing = 'normal' | 'difficult' | 'gasping' | 'absent' | 'unknown'
export type Bleeding = 'none' | 'minor' | 'severe' | 'unknown'
export type AgeGroup = 'child' | 'adult' | 'older_adult' | 'unknown'

/**
 * Findings a reporter can tick, grouped by the priority each one forces.
 *
 * The grouping is the protocol: anything in the P0 set is life-threatening on
 * its own, whatever else is true.
 */
export const P0_FINDINGS = {
  drowning: 'drowning or near-drowning',
  electrocution: 'electrical injury',
  allergic_reaction: 'possible severe allergic reaction',
} as const

export const P1_FINDINGS = {
  chest_pain: 'chest pain',
  stroke_signs: 'possible stroke signs',
  seizure: 'seizure',
  head_injury: 'head injury',
  overdose_suspected: 'suspected overdose or poisoning',
  pregnancy_related: 'pregnancy-related emergency',
  diabetic_episode: 'diabetic episode',
} as const

export const P2_FINDINGS = {
  burn: 'burn',
  fracture: 'possible fracture',
  heat_exhaustion: 'heat exhaustion',
  fainted_now_recovered: 'fainted but has recovered',
} as const

export type Finding =
  | keyof typeof P0_FINDINGS
  | keyof typeof P1_FINDINGS
  | keyof typeof P2_FINDINGS

/** How quickly someone should be *reached*, in seconds. Not a prognosis. */
export const REACH_TARGET_SECONDS: Record<Severity, number> = {
  P0: 180,
  P1: 480,
  P2: 1_200,
  P3: 3_600,
}

export interface MedicalReport {
  /** Responds to voice or touch. Null when the reporter cannot tell. */
  responsive: boolean | null
  breathing: Breathing
  bleeding: Bleeding
  findings: readonly Finding[]
  peopleAffected: number
  ageGroup: AgeGroup
}

export interface TriageReason {
  code: string
  detail: string
  /** True when this finding alone set the priority. */
  forced: boolean
}

export interface MedicalTriage {
  priority: Severity
  /** Why, in the order the rules fired — so a duty officer can overrule it. */
  reasons: TriageReason[]
  reachTargetSeconds: number
  /** What the responder sent must be able to do. */
  requiredSkills: string[]
}

const RANK: Record<Severity, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }

const worse = (a: Severity, b: Severity): Severity => (RANK[a] <= RANK[b] ? a : b)

/**
 * Triage a structured medical report.
 *
 * A cascade, not a weighted score — deliberately. In a medical context the
 * single worst finding has to decide the outcome: a person who is not
 * breathing is P0 however reassuring every other answer looks, and averaging
 * would let mild findings dilute a fatal one.
 *
 * @example
 * triageMedical({
 *   responsive: false, breathing: 'absent', bleeding: 'none',
 *   findings: [], peopleAffected: 1, ageGroup: 'adult',
 * }).priority // => 'P0'
 */
export function triageMedical(report: MedicalReport): MedicalTriage {
  let priority: Severity = 'P3'
  const reasons: TriageReason[] = []

  const bump = (level: Severity, code: string, detail: string, forced = false) => {
    priority = worse(priority, level)
    reasons.push({ code, detail, forced })
  }

  // ── Absolute red flags ────────────────────────────────────────────────
  if (report.breathing === 'absent' || report.breathing === 'gasping') {
    bump('P0', 'breathing_absent', 'Not breathing normally — this alone sets P0', true)
  }
  if (report.responsive === false) {
    bump('P0', 'unresponsive', 'Unresponsive — this alone sets P0', true)
  }
  if (report.bleeding === 'severe') {
    bump('P0', 'severe_bleeding', 'Severe bleeding — this alone sets P0', true)
  }
  for (const finding of report.findings) {
    if (finding in P0_FINDINGS) {
      const label = P0_FINDINGS[finding as keyof typeof P0_FINDINGS]
      bump('P0', finding, `${label} — this alone sets P0`, true)
    }
  }

  // ── Serious, time-critical ────────────────────────────────────────────
  if (report.breathing === 'difficult') {
    bump('P1', 'breathing_difficult', 'Difficulty breathing')
  }
  for (const finding of report.findings) {
    if (finding in P1_FINDINGS) {
      bump('P1', finding, P1_FINDINGS[finding as keyof typeof P1_FINDINGS])
    }
  }

  // ── Urgent but stable ─────────────────────────────────────────────────
  for (const finding of report.findings) {
    if (finding in P2_FINDINGS && finding !== 'fainted_now_recovered') {
      bump('P2', finding, P2_FINDINGS[finding as keyof typeof P2_FINDINGS])
    }
  }
  if (report.bleeding === 'minor') {
    bump('P2', 'minor_bleeding', 'Bleeding, described as minor')
  }

  // ── Modifiers ─────────────────────────────────────────────────────────
  // An unknown is treated as risk, never as reassurance: someone who cannot
  // tell whether the person is breathing is describing a worse situation
  // than someone who can confirm that they are.
  if (report.responsive === null && report.breathing === 'unknown' && priority === 'P3') {
    bump(
      'P2',
      'unknown_state',
      'Reporter cannot confirm responsiveness or breathing — treated as urgent',
    )
  }

  if (report.peopleAffected >= 3 && RANK[priority] > RANK.P1) {
    bump(
      'P1',
      'multiple_casualties',
      `${report.peopleAffected} people affected — needs more than one responder`,
    )
  }

  if (
    (report.ageGroup === 'child' || report.ageGroup === 'older_adult') &&
    RANK[priority] > RANK.P1
  ) {
    bump(
      'P1',
      'vulnerable_age',
      `Patient is a ${report.ageGroup.replace('_', ' ')} — escalated one level`,
    )
  }

  if (report.findings.includes('fainted_now_recovered') && priority === 'P3') {
    bump('P2', 'fainted', 'Fainted but has recovered — still needs assessment')
  }

  if (reasons.length === 0) {
    reasons.push({
      code: 'no_red_flags',
      detail: 'No red flags reported — routine response',
      forced: false,
    })
  }

  return {
    priority,
    reasons,
    reachTargetSeconds: REACH_TARGET_SECONDS[priority],
    requiredSkills: requiredSkills(priority, report),
  }
}

/** What the responder sent has to be able to do. */
function requiredSkills(priority: Severity, report: MedicalReport): string[] {
  const skills = ['first_aid']
  if (priority === 'P0') skills.push('aed_trained')
  if (report.peopleAffected >= 3) skills.push('incident_command')
  return skills
}

/**
 * The line every VitalPath response opens with.
 *
 * Carried across verbatim, because the module's own warning is the reason it
 * is safe to ship: this is a dispatch-priority tool, not a clinical one, and
 * nothing it says replaces calling emergency services.
 */
export const MEDICAL_DISCLAIMER =
  'Call emergency services now. This decides how fast someone reaches you — it is not medical advice.'
