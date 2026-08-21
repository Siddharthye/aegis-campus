import { generateCaseToken, hashCaseToken } from '@/domain/case-token'
import { createIncident, listIncidents } from '@/lib/incident-service'
import { ok, parseBody } from '@/lib/http'
import { createIncidentSchema } from '@/lib/schemas'

export const dynamic = 'force-dynamic'

/** `GET /api/incidents?drills=false` — all incidents, newest first. */
export async function GET(request: Request) {
  const includeDrills = new URL(request.url).searchParams.get('drills') !== 'false'
  const incidents = await listIncidents({ includeDrills })
  return ok({ incidents, count: incidents.length })
}

/**
 * `POST /api/incidents` — files a new incident report.
 *
 * When `wantsCaseToken` is set, a VEIL token is minted and returned **in this
 * response only**. Only its hash is stored, so this is the one moment the
 * plaintext exists anywhere — the reporter must keep it to follow up.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, createIncidentSchema)
  if (!parsed.success) return parsed.response

  const { wantsCaseToken, ...report } = parsed.data
  const caseToken = wantsCaseToken ? generateCaseToken() : null

  const incident = await createIncident({
    ...report,
    ...(caseToken ? { caseTokenHash: await hashCaseToken(caseToken) } : {}),
  })

  return ok({ incident, caseToken }, 201)
}
