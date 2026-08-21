import { randomInt, randomUUID } from 'node:crypto'
import { escalationReason, shouldEscalate, type SafeWalk } from '@/domain/safe-walk'
import {
  publicSession,
  sha256Hex,
  SENTINEL_COLLECTION,
  type SentinelSession,
} from '@/domain/sentinel-session'
import type { Coordinates } from '@/domain/types'
import { store } from '@/store'

const SAFE_WALKS = 'safe-walks'

const loadWalks = (): Promise<SafeWalk[]> => store.readCollection<SafeWalk>(SAFE_WALKS)

const saveWalks = (walks: readonly SafeWalk[]): Promise<void> =>
  store.writeCollection(SAFE_WALKS, walks)

export interface StartWalkInput {
  destination: string
  expectedMinutes: number
  origin: Coordinates
  trustedContacts?: string[]
}

/**
 * Begins a safe walk. The clock starts immediately; nothing else is scheduled,
 * because overdue state is derived on read rather than fired by a timer.
 *
 * @example
 * const walk = await startSafeWalk({ destination: 'Hostel 8', expectedMinutes: 12, origin })
 */
export async function startSafeWalk(input: StartWalkInput): Promise<SafeWalk> {
  const now = new Date().toISOString()
  const walk: SafeWalk = {
    id: `walk-${randomUUID().slice(0, 8)}`,
    startedAt: now,
    destination: input.destination,
    expectedMinutes: input.expectedMinutes,
    lastCheckInAt: now,
    status: 'walking',
    path: [input.origin],
    sentinelSessionId: null,
    trustedContacts: input.trustedContacts ?? [],
  }

  await saveWalks([...(await loadWalks()), walk])
  await store.appendEvent('safewalk.started', walk)
  return walk
}

/** Records a check-in, resetting the silence clock and extending the trail. */
export async function checkInSafeWalk(
  walkId: string,
  position?: Coordinates,
): Promise<SafeWalk | null> {
  const walks = await loadWalks()
  const walk = walks.find((item) => item.id === walkId)
  if (!walk || walk.status !== 'walking') return null

  const updated: SafeWalk = {
    ...walk,
    lastCheckInAt: new Date().toISOString(),
    path: position ? [...walk.path, position] : walk.path,
  }

  await saveWalks(walks.map((item) => (item.id === walkId ? updated : item)))
  await store.appendEvent('safewalk.checkin', { walkId, at: updated.lastCheckInAt })
  return updated
}

/** Closes a walk the person completed or called off themselves. */
export async function endSafeWalk(
  walkId: string,
  status: 'arrived' | 'cancelled',
): Promise<SafeWalk | null> {
  const walks = await loadWalks()
  const walk = walks.find((item) => item.id === walkId)
  if (!walk) return null

  const updated: SafeWalk = { ...walk, status }
  await saveWalks(walks.map((item) => (item.id === walkId ? updated : item)))
  await store.appendEvent(`safewalk.${status}`, { walkId })
  return updated
}

/**
 * Opens a silent-panic session on behalf of an overdue walker.
 *
 * The walker is not present to choose a PIN, so a random one is generated and
 * only its hash is kept — nobody, including the control room, can disarm the
 * session by knowing it. Ending an escalated walk is a control-room action
 * once a human has made contact, which is the correct authority for a session
 * its subject never consented to in the moment.
 */
async function escalateWalk(walk: SafeWalk, now: Date): Promise<SafeWalk> {
  const reason = escalationReason(walk, now)
  const lastKnown = walk.path.at(-1)

  const session: SentinelSession = {
    id: `snt-${randomUUID().slice(0, 8)}`,
    armedAt: now.toISOString(),
    lastPingAt: now.toISOString(),
    acknowledged: false,
    disarmedAt: null,
    path: lastKnown ? [{ ...lastKnown, at: walk.lastCheckInAt }] : [],
    label: `Safe Walk overdue — ${walk.destination}`,
    pinHash: await sha256Hex(randomInt(0, 10_000).toString().padStart(4, '0')),
  }

  const sessions = await store.readCollection<SentinelSession>(SENTINEL_COLLECTION)
  await store.writeCollection(SENTINEL_COLLECTION, [...sessions, session])
  await store.appendEvent('sentinel.armed', publicSession(session))

  const escalated: SafeWalk = { ...walk, status: 'escalated', sentinelSessionId: session.id }
  await store.appendEvent('safewalk.escalated', { walkId: walk.id, reason, sessionId: session.id })
  return escalated
}

/**
 * Every safe walk, escalating any that have gone silent or overrun.
 *
 * Escalation happens here, on read, rather than on a timer — see the module
 * comment in `domain/safe-walk.ts`. The control room polls this, so an overdue
 * walker surfaces within one poll interval whether or not their phone is still
 * talking to us.
 *
 * @example
 * const walks = await listSafeWalks()
 * walks.filter((walk) => walk.status === 'escalated')
 */
export async function listSafeWalks(): Promise<SafeWalk[]> {
  const now = new Date()
  const walks = await loadWalks()

  const overdue = walks.filter((walk) => shouldEscalate(walk, now))
  if (overdue.length === 0) return walks

  const escalatedById = new Map<string, SafeWalk>()
  for (const walk of overdue) {
    escalatedById.set(walk.id, await escalateWalk(walk, now))
  }

  const next = walks.map((walk) => escalatedById.get(walk.id) ?? walk)
  await saveWalks(next)
  return next
}
