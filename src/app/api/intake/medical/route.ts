import { z } from 'zod'
import { CAMPUS_CENTRE } from '@/data/campus'
import { nearestBuilding } from '@/domain/campus-geometry'
import {
  MEDICAL_DISCLAIMER,
  triageMedical,
  type Finding,
  type MedicalReport,
} from '@/domain/medical-triage'
import type { LocatedPosition } from '@/domain/types'
import { fail, ok, parseBody } from '@/lib/http'
import { intakeReport } from '@/lib/intake-service'

export const dynamic = 'force-dynamic'

const findingSchema = z.enum([
  'drowning',
  'electrocution',
  'allergic_reaction',
  'chest_pain',
  'stroke_signs',
  'seizure',
  'head_injury',
  'overdose_suspected',
  'pregnancy_related',
  'diabetic_episode',
  'burn',
  'fracture',
  'heat_exhaustion',
  'fainted_now_recovered',
])

/**
 * VitalPath's four questions, plus where and who.
 *
 * `responsive` is nullable rather than defaulting to true: "I cannot tell"
 * is a real answer and a worse one than "yes", and collapsing it into either
 * would throw away the finding the protocol cares most about.
 */
const medicalReportSchema = z.object({
  responsive: z.boolean().nullable().default(null),
  breathing: z.enum(['normal', 'difficult', 'gasping', 'absent', 'unknown']).default('unknown'),
  bleeding: z.enum(['none', 'minor', 'severe', 'unknown']).default('unknown'),
  findings: z.array(findingSchema).default([]),
  peopleAffected: z.number().int().min(1).max(500).default(1),
  ageGroup: z.enum(['child', 'adult', 'older_adult', 'unknown']).default('unknown'),
  note: z.string().max(500).default(''),
  lat: z.number().optional(),
  lng: z.number().optional(),
  reporterId: z.string().nullable().default(null),
})

/**
 * `POST /api/intake/medical` — structured medical intake.
 *
 * The acquired VitalPath module, landing in AEGIS. A general "describe what
 * happened" box is the wrong shape for a medical emergency; these four
 * questions separate someone who fainted and is sitting up from someone who
 * is unresponsive and not breathing, in about eight seconds.
 *
 * The triage decides the severity, and the reasons that produced it are
 * written into the incident so a duty officer can see why and overrule it.
 * From there the report joins the same pipeline as any other — it fuses,
 * it ranks by SLA pressure, it dispatches.
 *
 * @example
 * curl -X POST /api/intake/medical -H 'Content-Type: application/json' \
 *   -d '{"responsive":false,"breathing":"absent"}'
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, medicalReportSchema)
  if (!parsed.success) return parsed.response

  const input = parsed.data
  const report: MedicalReport = {
    responsive: input.responsive,
    breathing: input.breathing,
    bleeding: input.bleeding,
    findings: input.findings as Finding[],
    peopleAffected: input.peopleAffected,
    ageGroup: input.ageGroup,
  }

  const triage = triageMedical(report)

  const result = await intakeReport({
    category: 'medical',
    severity: triage.priority,
    title: describe(triage.reasons[0]?.detail ?? 'Medical emergency', input.peopleAffected),
    description: [
      input.note.trim(),
      `Triaged ${triage.priority} — reach within ${Math.round(triage.reachTargetSeconds / 60)} min.`,
      ...triage.reasons.map((reason) => `· ${reason.detail}`),
      `Responder must be: ${triage.requiredSkills.join(', ')}.`,
    ]
      .filter(Boolean)
      .join('\n'),
    location: locate(input.lat, input.lng),
    reporterId: input.reporterId,
  })

  return ok(
    {
      incident: result.incident,
      priority: triage.priority,
      reasons: triage.reasons,
      reachTargetSeconds: triage.reachTargetSeconds,
      requiredSkills: triage.requiredSkills,
      disclaimer: MEDICAL_DISCLAIMER,
      fused: result.fused,
    },
    result.fused ? 200 : 201,
  )
}

/** A queue line that leads with the finding that decided the priority. */
function describe(leadReason: string, peopleAffected: number): string {
  const headline = leadReason.split(' — ')[0]
  return peopleAffected > 1 ? `${headline} (${peopleAffected} people)` : headline
}

/**
 * Where the emergency is.
 *
 * Same honesty as the WhatsApp intake: without coordinates there is no
 * position, so the incident sits at the campus centre with the confidence of
 * a guess rather than inventing precision a dispatcher would act on.
 */
function locate(lat?: number, lng?: number): LocatedPosition {
  if (lat === undefined || lng === undefined) {
    return {
      ...CAMPUS_CENTRE,
      label: 'Campus 25 · location not given',
      method: 'gps',
      confidence: 0.1,
    }
  }

  const { building } = nearestBuilding(lat, lng)
  return {
    lat,
    lng,
    label: `${building.shortName} · medical intake`,
    method: 'gps',
    confidence: 0.4,
    buildingId: building.id,
  }
}
