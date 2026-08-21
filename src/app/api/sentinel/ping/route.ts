import { applyPing, isActiveSession, SENTINEL_COLLECTION, type SentinelSession } from '@/domain/sentinel-session'
import { fail, ok, parseBody } from '@/lib/http'
import { sentinelPingSchema } from '@/lib/sentinel-schemas'
import { store } from '@/store'

export const dynamic = 'force-dynamic'

/**
 * `POST /api/sentinel/ping` — one location breadcrumb on an armed session.
 *
 * The decoy calculator posts here every ~4 seconds while mounted, so the
 * control room sees a moving trail and a fresh liveness clock. Pings against
 * a disarmed or unknown session are refused.
 *
 * @example
 * await fetch('/api/sentinel/ping', {
 *   method: 'POST',
 *   body: JSON.stringify({ sessionId: 'snt-1a2b3c4d', lat: 20.3536, lng: 85.8195 }),
 * })
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, sentinelPingSchema)
  if (!parsed.success) return parsed.response

  const { sessionId, lat, lng } = parsed.data
  const sessions = await store.readCollection<SentinelSession>(SENTINEL_COLLECTION)
  const session = sessions.find((item) => item.id === sessionId)
  if (!session || !isActiveSession(session)) return fail('No armed session with that id', 404)

  const point = { lat, lng, at: new Date().toISOString() }
  const updated = applyPing(session, point)

  await store.writeCollection(
    SENTINEL_COLLECTION,
    sessions.map((item) => (item.id === sessionId ? updated : item)),
  )
  await store.appendEvent('sentinel.ping', { sessionId, ...point, label: updated.label })

  return ok({ sessionId, lastPingAt: updated.lastPingAt, points: updated.path.length })
}
