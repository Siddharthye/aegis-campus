import { listResponders } from '@/lib/incident-service'
import { ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** `GET /api/responders` — every responder with unit, status, and position. */
export async function GET() {
  const responders = await listResponders()
  return ok({ responders, count: responders.length })
}
