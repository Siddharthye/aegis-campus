import { hashCaseToken, toCaseStatus } from '@/domain/case-token'
import { findIncidentByCaseTokenHash } from '@/lib/incident-service'
import { fail, ok } from '@/lib/http'
import { caseTokenSchema } from '@/lib/schemas'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ token: string }> }

/**
 * `GET /api/cases/:token`
 *
 * Anonymous case follow-up. The reporter presents the token they were shown
 * once at report time; the server hashes it and looks for a match.
 *
 * Unauthenticated by design — the token *is* the credential, which is the
 * only way to offer follow-up to someone who deliberately gave no identity.
 * Two consequences are handled deliberately: the response is a narrow
 * projection (`toCaseStatus`) rather than the incident, and an unknown token
 * and a malformed one return the same 404, so the endpoint cannot be used to
 * probe which tokens exist.
 *
 * @example
 * const { case: status } = await fetch('/api/cases/AEG-7K2M-QP49').then((r) => r.json())
 * status.status // => 'dispatched'
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { token } = await params

  const parsed = caseTokenSchema.safeParse(decodeURIComponent(token))
  if (!parsed.success) return fail('No case matches that token', 404)

  const incident = await findIncidentByCaseTokenHash(await hashCaseToken(parsed.data))
  if (!incident) return fail('No case matches that token', 404)

  return ok({ case: toCaseStatus(incident) })
}
