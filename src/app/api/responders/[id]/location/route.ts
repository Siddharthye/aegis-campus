import { z } from 'zod'
import { estimateArrival } from '@/domain/dispatch'
import { getIncident, updateResponderLocation } from '@/lib/incident-service'
import { fail, ok, parseBody } from '@/lib/http'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

/**
 * `POST /api/responders/:id/location { lat, lng }`
 *
 * A responder in the field reports where they are. The response carries their
 * live arrival estimate for whatever they are assigned to, so the handset that
 * sent the position immediately learns how far it still has to go without a
 * second round trip.
 *
 * @example
 * await fetch(`/api/responders/resp-fire-1/location`, {
 *   method: 'POST', body: JSON.stringify({ lat: 20.3536, lng: 85.8195 }),
 * })
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params
  const parsed = await parseBody(request, locationSchema)
  if (!parsed.success) return parsed.response

  const responder = await updateResponderLocation(id, parsed.data.lat, parsed.data.lng)
  if (!responder) return fail('Unknown responder', 404)

  const incident = responder.incidentId ? await getIncident(responder.incidentId) : null
  const arrival = incident ? estimateArrival(responder.location, incident.location) : null

  return ok({ responder, arrival })
}
