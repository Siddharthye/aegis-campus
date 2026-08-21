import type { IncidentCategory, Severity } from '@/domain/types'

/**
 * The FUSION module, consumed over its public HTTP API.
 *
 * This is the dogfood proof: AEGIS reaches one of its own sellable modules the
 * exact way a buyer would — no shared imports, no reaching into internals,
 * just the documented endpoint. If this file could not exist, the module would
 * not really be standalone.
 *
 * Every call is bounded by a short timeout and every failure returns null.
 * Filing an emergency report must never wait on, or be blocked by, an optional
 * subsystem; the caller falls back to the local matcher in
 * `domain/report-matching.ts`.
 */

/** A report screen must not stall on a module that is down or unreachable. */
const FUSION_TIMEOUT_MS = 700

const fusionBaseUrl = (): string =>
  process.env.FUSION_URL ?? process.env.NEXT_PUBLIC_FUSION_URL ?? 'http://localhost:4104'

/** What FUSION decided about one submitted report. */
export interface FusionVerdict {
  /** FUSION's own incident id — mapped to an AEGIS incident by the service. */
  fusionIncidentId: string
  /** True when this report founded a new incident rather than joining one. */
  isNew: boolean
  corroborationCount: number
  confidence: number
  severity: Severity
  /** True when FUSION held the report for review instead of dispatching it. */
  quarantined: boolean
}

export interface FusionSubmission {
  text: string
  lat: number
  lng: number
  category: IncidentCategory
  /** Stable per-reporter token; anonymous reports get a synthetic one. */
  reporterToken: string
}

/**
 * Submits a report to FUSION and returns its verdict, or null when FUSION is
 * unreachable, slow, or answers with anything unexpected.
 *
 * @example
 * const verdict = await submitToFusion({ text: 'Smoke in Block C', lat, lng, category: 'fire', reporterToken: 's-1' })
 * verdict?.isNew // => false when it joined an existing incident
 */
export async function submitToFusion(report: FusionSubmission): Promise<FusionVerdict | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FUSION_TIMEOUT_MS)

  try {
    const response = await fetch(`${fusionBaseUrl()}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...report, at: new Date().toISOString() }),
      signal: controller.signal,
      cache: 'no-store',
    })

    // 201 founded, 200 corroborated, 202 quarantined — all are real answers.
    if (!response.ok) return null

    const body = (await response.json()) as Partial<{
      incidentId: string
      isNew: boolean
      corroborationCount: number
      confidence: number
      severity: Severity
      quarantined: boolean
    }>

    if (typeof body.incidentId !== 'string') return null

    return {
      fusionIncidentId: body.incidentId,
      isNew: body.isNew ?? true,
      corroborationCount: body.corroborationCount ?? 1,
      confidence: body.confidence ?? 0.5,
      severity: body.severity ?? 'P2',
      quarantined: body.quarantined ?? false,
    }
  } catch {
    // Unreachable, aborted, or malformed. The local matcher takes over.
    return null
  } finally {
    clearTimeout(timeout)
  }
}
