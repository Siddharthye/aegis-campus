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

/** `POST /api/incidents` — files a new incident report. */
export async function POST(request: Request) {
  const parsed = await parseBody(request, createIncidentSchema)
  if (!parsed.success) return parsed.response

  const incident = await createIncident(parsed.data)
  return ok({ incident }, 201)
}
