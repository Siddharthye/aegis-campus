import { randomInt, randomUUID } from 'node:crypto'
import { CAMPUS_CENTRE } from '@/data/campus'
import { nearestBuilding } from '@/domain/beacon'
import { publicSession, sha256Hex, SENTINEL_COLLECTION, type SentinelSession } from '@/domain/sentinel-session'
import { ok, parseBody } from '@/lib/http'
import { armSentinelSchema } from '@/lib/sentinel-schemas'
import { store } from '@/store'

export const dynamic = 'force-dynamic'

/**
 * `POST /api/sentinel/arm` — covertly opens a silent-panic session.
 *
 * Returns the session id and a 4-digit disarm PIN. The PIN is shown to the
 * user exactly once and only its SHA-256 lands in the store — the armed event
 * broadcast to the control room carries no secret at all.
 *
 * @example
 * const { sessionId, pin } = await fetch('/api/sentinel/arm', {
 *   method: 'POST', body: JSON.stringify({ lat: 20.3536, lng: 85.8195 }),
 * }).then((r) => r.json())
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, armSentinelSchema)
  if (!parsed.success) return parsed.response

  const lat = parsed.data.lat ?? CAMPUS_CENTRE.lat
  const lng = parsed.data.lng ?? CAMPUS_CENTRE.lng
  const label = parsed.data.label ?? `Near ${nearestBuilding(lat, lng).building.shortName}`

  const pin = randomInt(0, 10_000).toString().padStart(4, '0')
  const now = new Date().toISOString()

  const session: SentinelSession = {
    id: `snt-${randomUUID().slice(0, 8)}`,
    armedAt: now,
    lastPingAt: now,
    acknowledged: false,
    disarmedAt: null,
    path: [{ lat, lng, at: now }],
    label,
    pinHash: await sha256Hex(pin),
  }

  const sessions = await store.readCollection<SentinelSession>(SENTINEL_COLLECTION)
  await store.writeCollection(SENTINEL_COLLECTION, [...sessions, session])
  await store.appendEvent('sentinel.armed', publicSession(session))

  return ok({ sessionId: session.id, pin }, 201)
}
