import { ok } from '@/lib/http'
import { storageBackend } from '@/store'

export const dynamic = 'force-dynamic'

/** `GET /api/health` — liveness probe. */
export async function GET() {
  return ok({
    service: 'aegis-campus',
    status: 'ok',
    storageBackend,
    at: new Date().toISOString(),
  })
}
