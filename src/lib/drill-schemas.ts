import { z } from 'zod'

/**
 * Request schemas for the DRILL playback API.
 */

/** Fastest playback we allow: beyond this the SLA clocks stop being legible. */
const MAX_SPEED = 8

/**
 * `POST /api/drill` body — starts a scenario.
 *
 * @example
 * startDrillSchema.parse({ scenario: 'blockc-fire', speed: 2 })
 */
export const startDrillSchema = z.object({
  scenario: z.string().min(1).max(60),
  speed: z.number().min(0.25).max(MAX_SPEED).default(1),
})

/**
 * `POST /api/drill/tick` body — advances a running drill clock.
 *
 * @example
 * tickDrillSchema.parse({ drillId: 'drl-1a2b3c4d' })
 */
export const tickDrillSchema = z.object({
  drillId: z.string().min(1).max(60),
})
