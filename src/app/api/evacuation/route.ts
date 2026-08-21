import { z } from 'zod'
import { planEvacuation, warrantsEvacuation } from '@/domain/evacuation'
import { SAFE_ZONES } from '@/data/safe-zones'
import { getIncident } from '@/lib/incident-service'
import { fail, ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  incidentId: z.string().min(1).max(60),
  /** Where the person asking is. Defaults to the incident itself. */
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
})

/**
 * `GET /api/evacuation?incidentId=&lat=&lng=`
 *
 * Where to walk, given an active hazard. Returns the chosen muster point, the
 * distance and direction, buildings to route around, and a ready-to-broadcast
 * sentence.
 *
 * @example
 * const { plan } = await fetch('/api/evacuation?incidentId=inc-4f9a12c0').then((r) => r.json())
 * plan.instruction
 * // => 'Evacuate north-east to Main Ground — the open ground east of the Library, about 240m.'
 */
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = querySchema.safeParse(params)
  if (!parsed.success) return fail('Validation failed', 400, parsed.error.issues)

  const incident = await getIncident(parsed.data.incidentId)
  if (!incident) return fail('Unknown incident', 404)

  const from = {
    lat: parsed.data.lat ?? incident.location.lat,
    lng: parsed.data.lng ?? incident.location.lng,
  }
  const plan = planEvacuation(incident.location, from)

  return ok({
    plan,
    warranted: warrantsEvacuation(incident),
    zones: SAFE_ZONES,
  })
}
