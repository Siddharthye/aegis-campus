import { z } from 'zod'

/**
 * Request schemas for the SENTINEL silent-panic API. Kept separate from the
 * incident schemas so each module's contract can evolve independently.
 */

/**
 * `POST /api/sentinel/arm` body. Everything is optional: arming must never
 * fail for want of a GPS fix — the server falls back to the campus centre.
 *
 * @example
 * armSentinelSchema.parse({ lat: 20.3536, lng: 85.8195 })
 */
export const armSentinelSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  /** Overrides the derived label — used by Safe Walk overdue auto-arms. */
  label: z.string().min(1).max(160).optional(),
})

/**
 * `POST /api/sentinel/ping` body — one breadcrumb on an armed session.
 *
 * @example
 * sentinelPingSchema.parse({ sessionId: 'snt-1a2b3c4d', lat: 20.3536, lng: 85.8195 })
 */
export const sentinelPingSchema = z.object({
  sessionId: z.string().min(1).max(60),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

/**
 * `POST /api/sentinel/disarm` body. The PIN is the raw 4 digits typed into
 * the decoy calculator — hashed and compared server-side, never stored.
 *
 * @example
 * disarmSentinelSchema.parse({ sessionId: 'snt-1a2b3c4d', pin: '4102' })
 */
export const disarmSentinelSchema = z.object({
  sessionId: z.string().min(1).max(60),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
})
