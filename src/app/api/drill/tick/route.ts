import { tickDrill } from '@/lib/drill-service'
import { fail, ok, parseBody } from '@/lib/http'
import { tickDrillSchema } from '@/lib/drill-schemas'

export const dynamic = 'force-dynamic'

/**
 * `POST /api/drill/tick { drillId }`
 *
 * Executes whatever scripted steps have come due on the drill clock. The
 * control room calls this on an interval while a drill is running; the call is
 * idempotent, so a duplicate or replayed tick changes nothing.
 *
 * @example
 * const { executed, nextStepInMs } = await fetch('/api/drill/tick', {
 *   method: 'POST', body: JSON.stringify({ drillId }),
 * }).then((r) => r.json())
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, tickDrillSchema)
  if (!parsed.success) return parsed.response

  const tick = await tickDrill(parsed.data.drillId)
  if (!tick) return fail('Unknown drill', 404)

  return ok(tick)
}
