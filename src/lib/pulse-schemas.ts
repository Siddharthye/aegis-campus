import { z } from 'zod'

/**
 * Validation for the PULSE / integration territory. Deliberately a separate
 * file from `src/lib/schemas.ts` so parallel workstreams never collide.
 */

/**
 * Query contract for the `/api/ext` reverse proxy — `?base=` must be a URL.
 * The allowlist check happens in the route; this only guarantees shape.
 *
 * @example
 * extProxyQuerySchema.parse({ base: 'http://localhost:4101' })
 * // => { base: 'http://localhost:4101' }
 */
export const extProxyQuerySchema = z.object({
  base: z.url().max(200),
})

/**
 * Proxied POST bodies are forwarded verbatim, so any valid JSON document
 * passes — `parseBody` still rejects malformed JSON before it travels.
 *
 * @example
 * extProxyBodySchema.parse({ anything: ['goes', 42] }) // => same object back
 */
export const extProxyBodySchema = z.unknown()
