import { getDrillAfterAction } from '@/lib/drill-service'
import { fail, ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * `GET /api/drill/:id/report`
 *
 * The graded after-action report: detection, dispatch and resolution times per
 * incident, SLA outcomes, and a letter grade. Computed from the same timelines
 * the control room shows, so every number is auditable.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params
  const report = await getDrillAfterAction(id)
  if (!report) return fail('Unknown drill', 404)

  return ok({ report })
}
