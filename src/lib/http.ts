import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'

/** Success response. */
export const ok = <T>(body: T, status = 200) => NextResponse.json(body, { status })

/** Error response in a single consistent shape, so buyers parse one thing. */
export const fail = (message: string, status = 400, details?: unknown) =>
  NextResponse.json({ error: message, details }, { status })

/**
 * Parses and validates a JSON request body.
 *
 * Returns a discriminated union rather than throwing, so route handlers stay
 * linear and every validation failure reaches the caller as a readable 400.
 *
 * @example
 * const parsed = await parseBody(request, createAlertSchema)
 * if (!parsed.success) return parsed.response
 * // parsed.data is fully typed here
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  let raw: unknown

  try {
    raw = await request.json()
  } catch {
    return { success: false, response: fail('Request body must be valid JSON') }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    return { success: false, response: fail('Validation failed', 400, result.error.issues) }
  }

  return { success: true, data: result.data }
}
