import { isActiveSession, publicSession, SENTINEL_COLLECTION, type SentinelSession } from '@/domain/sentinel-session'
import { ok } from '@/lib/http'
import { store } from '@/store'

export const dynamic = 'force-dynamic'

/**
 * `GET /api/sentinel/sessions?active=true`
 *
 * Silent-panic sessions for the control room lane. PIN hashes never appear in
 * the response — the store keeps them and nothing else ever sees them.
 *
 * @example
 * const { sessions } = await fetch('/api/sentinel/sessions?active=true').then((r) => r.json())
 * sessions[0].path.length // => 12 breadcrumbs so far
 */
export async function GET(request: Request) {
  const activeOnly = new URL(request.url).searchParams.get('active') === 'true'
  const stored = await store.readCollection<SentinelSession>(SENTINEL_COLLECTION)

  const visible = activeOnly ? stored.filter(isActiveSession) : stored
  const sessions = visible
    .map(publicSession)
    .sort((a, b) => b.armedAt.localeCompare(a.armedAt))

  return ok({ sessions, count: sessions.length })
}
