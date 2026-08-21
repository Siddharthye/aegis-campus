import { sha256Hex } from './crypto-hash'

/**
 * SENTINEL — silent panic. A session is armed covertly from the report screen,
 * streams location pings while a decoy calculator covers the display, and is
 * disarmed by typing a memorized PIN into that calculator. Pure shapes and
 * transforms only — persistence and hashing policy live at the edges.
 */

/** One location fix on a sentinel session's breadcrumb trail. */
export interface SentinelPingPoint {
  lat: number
  lng: number
  at: string
}

/** A silent-panic session as stored in the `sentinel` collection. */
export interface SentinelSession {
  id: string
  armedAt: string
  lastPingAt: string
  /** Flipped by the control room when a human has eyes on it. */
  acknowledged: boolean
  disarmedAt: string | null
  /** Breadcrumb trail, oldest first, capped at MAX_PATH_POINTS. */
  path: SentinelPingPoint[]
  /** Where this started, e.g. "Near Block C" or "Safe Walk overdue — Hostel 8". */
  label: string
  /** SHA-256 of the 4-digit disarm PIN. The PIN itself is never stored. */
  pinHash: string
}

/** Store collection name shared by arm/ping/disarm and the control room. */
export const SENTINEL_COLLECTION = 'sentinel'

/** Path cap: at one ping per ~4s this is roughly 16 minutes of trail. */
export const MAX_PATH_POINTS = 240

/**
 * True while a session should still accept pings and appear on consoles.
 *
 * @example
 * isActiveSession({ ...session, disarmedAt: null }) // => true
 */
export function isActiveSession(session: SentinelSession): boolean {
  return session.disarmedAt === null
}

/**
 * Appends a location fix, advancing the liveness clock and capping the trail.
 * Returns a new session — never mutates.
 *
 * @example
 * applyPing(session, { lat: 20.3536, lng: 85.8195, at: now }).lastPingAt // => now
 */
export function applyPing(session: SentinelSession, point: SentinelPingPoint): SentinelSession {
  return {
    ...session,
    lastPingAt: point.at,
    path: [...session.path, point].slice(-MAX_PATH_POINTS),
  }
}

/**
 * The session as broadcast on the event stream — identical shape minus the
 * PIN hash, which never leaves the store.
 *
 * @example
 * 'pinHash' in publicSession(session) // => false
 */
export function publicSession(session: SentinelSession): Omit<SentinelSession, 'pinHash'> {
  const { pinHash: _pinHash, ...visible } = session
  return visible
}

/** Re-exported so SENTINEL callers have one import for the whole subsystem. */
export { sha256Hex }
