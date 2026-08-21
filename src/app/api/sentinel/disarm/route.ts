import { isActiveSession, publicSession, sha256Hex, SENTINEL_COLLECTION, type SentinelSession } from '@/domain/sentinel-session'
import { ok, parseBody } from '@/lib/http'
import { disarmSentinelSchema } from '@/lib/sentinel-schemas'
import { store } from '@/store'

export const dynamic = 'force-dynamic'

/**
 * `POST /api/sentinel/disarm` — ends a session if the PIN is right.
 *
 * Always answers 200 `{ disarmed: boolean }`: a wrong PIN, an unknown session
 * and a correct disarm are indistinguishable to anyone watching the phone or
 * the network tab. The decoy calculator shows the arithmetic result either
 * way — only `disarmed: true` quietly closes the cover.
 *
 * @example
 * const { disarmed } = await fetch('/api/sentinel/disarm', {
 *   method: 'POST', body: JSON.stringify({ sessionId: 'snt-1a2b3c4d', pin: '4102' }),
 * }).then((r) => r.json())
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, disarmSentinelSchema)
  if (!parsed.success) return parsed.response

  const { sessionId, pin } = parsed.data
  const sessions = await store.readCollection<SentinelSession>(SENTINEL_COLLECTION)
  const session = sessions.find((item) => item.id === sessionId)
  if (!session || !isActiveSession(session)) return ok({ disarmed: false })

  const pinHash = await sha256Hex(pin)
  if (pinHash !== session.pinHash) return ok({ disarmed: false })

  const updated: SentinelSession = { ...session, disarmedAt: new Date().toISOString() }
  await store.writeCollection(
    SENTINEL_COLLECTION,
    sessions.map((item) => (item.id === sessionId ? updated : item)),
  )
  await store.appendEvent('sentinel.disarmed', publicSession(updated))

  return ok({ disarmed: true })
}
