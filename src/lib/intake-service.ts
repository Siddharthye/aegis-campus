import { findFusionCandidate, type IncomingReport } from '@/domain/report-matching'
import type { Incident } from '@/domain/types'
import { submitToFusion } from './fusion-client'
import {
  corroborateIncident,
  createIncident,
  escalateSeverity,
  findIncidentByFusionId,
  listIncidents,
  noteOnIncident,
  type CreateIncidentInput,
} from './incident-service'

/**
 * Report intake — the one door every report comes through.
 *
 * Fifty people reporting one fire must produce **one** incident with forty-nine
 * corroborations, not fifty rows. That decision happens here, in this order:
 *
 * 1. Ask the FUSION module over HTTP. It is the real engine and the proof the
 *    module is genuinely standalone.
 * 2. If FUSION is unreachable, fall back to the local matcher, which is
 *    offline, deterministic, and deliberately more conservative.
 *
 * The demo must survive a venue with no wifi and a module that is not running,
 * so neither path is allowed to be the only one that works.
 */

export type FusionEngine = 'fusion-module' | 'local' | 'none'

export interface IntakeResult {
  incident: Incident
  /** True when this report joined an existing incident instead of opening one. */
  fused: boolean
  /** Which engine made the call — surfaced in the UI, never hidden. */
  engine: FusionEngine
  /** Why it fused, when it did. */
  rationale?: string
}

/**
 * Files a report, fusing it into an existing incident when it describes one.
 *
 * @example
 * const result = await intakeReport(input)
 * result.fused // => true when it corroborated an existing incident
 * result.engine // => 'fusion-module' | 'local'
 */
export async function intakeReport(input: CreateIncidentInput): Promise<IntakeResult> {
  const verdict = await submitToFusion({
    text: `${input.title}. ${input.description}`,
    lat: input.location.lat,
    lng: input.location.lng,
    category: input.category,
    // Anonymous reporters still need a stable-looking token for FUSION's
    // repeat-offender heuristics; it is synthetic and links to nobody.
    reporterToken: input.reporterId ?? `anon-${Math.random().toString(36).slice(2, 10)}`,
  })

  if (verdict) {
    const existing = verdict.isNew ? null : await findIncidentByFusionId(verdict.fusionIncidentId)

    if (existing) {
      await corroborateIncident(existing.id, verdict.corroborationCount, verdict.confidence)

      // FUSION weighs velocity and reporter diversity we do not model locally,
      // so its severity can outrank what our own rule derives from the same
      // counts. Take the more urgent of the two; never the less.
      const updated = await escalateSeverity(
        existing.id,
        verdict.severity,
        `FUSION assessed the fused cluster as ${verdict.severity} · ${verdict.corroborationCount} reports`,
      )

      return {
        incident: updated ?? existing,
        fused: true,
        engine: 'fusion-module',
        rationale: `FUSION matched this to an open incident · ${verdict.corroborationCount} reports at ${Math.round(verdict.confidence * 100)}% confidence`,
      }
    }

    const incident = await createIncident({ ...input, fusionIncidentId: verdict.fusionIncidentId })

    // A quarantined report still becomes an incident here, but the dispatcher
    // is told FUSION distrusted it rather than having it silently dropped.
    if (verdict.quarantined) {
      const flagged = await noteOnIncident(
        incident.id,
        'flagged',
        'FUSION quarantined this report for review — corroborate before dispatching.',
      )
      return { incident: flagged ?? incident, fused: false, engine: 'fusion-module' }
    }

    return { incident, fused: false, engine: 'fusion-module' }
  }

  return intakeLocally(input)
}

/** The offline path: local matcher over the open incidents we already hold. */
async function intakeLocally(input: CreateIncidentInput): Promise<IntakeResult> {
  const now = new Date()
  const report: IncomingReport = {
    category: input.category,
    title: input.title,
    description: input.description,
    location: input.location,
    at: now,
  }

  const open = (await listIncidents({ includeDrills: false })).filter(
    (incident) => incident.status !== 'resolved',
  )
  const match = findFusionCandidate(report, open, now)

  if (!match) {
    return { incident: await createIncident(input), fused: false, engine: 'local' }
  }

  const reportCount = match.incident.reportCount + 1
  // Confidence climbs with each corroborating reporter and saturates below 1 —
  // more witnesses raise certainty but never make it absolute.
  const confidence = Math.min(0.97, 0.45 + 0.18 * Math.log2(reportCount + 1))
  const updated = await corroborateIncident(match.incident.id, reportCount, confidence)

  return {
    incident: updated ?? match.incident,
    fused: true,
    engine: 'local',
    rationale: match.rationale,
  }
}
