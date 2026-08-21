import { z } from 'zod'
import { getRiskSnapshot } from '@/lib/risk-service'
import { fail, ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  /** Hour to score for, 0–23. Defaults to now on the server. */
  hour: z.coerce.number().int().min(0).max(23).optional(),
})

/**
 * `GET /api/risk?hour=22`
 *
 * SIGHTLINE: where incidents repeat, and which way to walk because of it.
 *
 * The interesting property is that this is unanswerable without the incident
 * corpus. A maps app can route you by time; only the platform holding every
 * report can route you around the stretch where six different people were
 * followed between nine and midnight.
 *
 * @example
 * const risk = await fetch('/api/risk?hour=22').then((r) => r.json())
 * risk.routes[0].reason
 */
export async function GET(request: Request) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  )
  if (!parsed.success) return fail('Validation failed', 400, parsed.error.issues)

  const hour = parsed.data.hour ?? new Date().getHours()
  return ok(await getRiskSnapshot(hour))
}
