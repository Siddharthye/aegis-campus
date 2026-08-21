import { getStats } from '@/lib/incident-service'
import { ok } from '@/lib/http'
import { storageBackend } from '@/store'

export const dynamic = 'force-dynamic'

/** `GET /api/stats` — headline numbers for the control room and landing page. */
export async function GET() {
  return ok({ ...(await getStats()), storageBackend })
}
