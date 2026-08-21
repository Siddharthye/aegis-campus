import { z } from 'zod'
import { recordBroadcast } from '@/lib/incident-service'
import { fail, ok, parseBody } from '@/lib/http'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

const broadcastSchema = z.object({
  message: z.string().min(1).max(300),
  actor: z.string().min(1).max(80).default('dispatcher'),
})

/**
 * `POST /api/incidents/:id/broadcast { message }`
 *
 * Records a geofenced broadcast against an incident. Delivery is SIREN's job —
 * AEGIS calls it over its public HTTP API like any other buyer would. What
 * this endpoint owns is the audit entry proving who was told what, and when.
 *
 * @example
 * await fetch(`/api/incidents/${id}/broadcast`, {
 *   method: 'POST',
 *   body: JSON.stringify({ message: 'Evacuate via the west stairwell' }),
 * })
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params
  const parsed = await parseBody(request, broadcastSchema)
  if (!parsed.success) return parsed.response

  const incident = await recordBroadcast(id, parsed.data.message, parsed.data.actor)
  if (!incident) return fail('Unknown incident', 404)

  return ok({ incident }, 201)
}
