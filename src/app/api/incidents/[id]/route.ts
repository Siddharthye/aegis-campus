import { assignResponder, getIncident, getRecommendations, updateStatus } from '@/lib/incident-service'
import { fail, ok, parseBody } from '@/lib/http'
import { updateIncidentSchema } from '@/lib/schemas'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

/** `GET /api/incidents/:id` — one incident plus ranked dispatch suggestions. */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params
  const incident = await getIncident(id)
  if (!incident) return fail('Unknown incident', 404)

  const recommendations = incident.status === 'resolved' ? [] : await getRecommendations(id)
  return ok({ incident, recommendations })
}

/**
 * `PATCH /api/incidents/:id`
 * Advances status and/or assigns a responder. Both go through the timeline, so
 * every transition is auditable.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params
  const parsed = await parseBody(request, updateIncidentSchema)
  if (!parsed.success) return parsed.response

  const { status, assignResponderId, actor, detail } = parsed.data
  let incident = await getIncident(id)
  if (!incident) return fail('Unknown incident', 404)

  if (assignResponderId) {
    incident = await assignResponder(id, assignResponderId, actor)
    if (!incident) return fail('Unknown responder', 404)
  }

  if (status) {
    incident = await updateStatus(id, status, actor, detail)
    if (!incident) return fail('Unknown incident', 404)
  }

  return ok({ incident })
}
