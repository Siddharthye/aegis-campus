import { listIncidents, listResponders } from '@/lib/incident-service'
import { ok, parseBody } from '@/lib/http'
import { askNexbot } from '@/lib/nexbot'
import { assistSchema } from '@/lib/schemas'

export const dynamic = 'force-dynamic'

/**
 * `POST /api/assist { question }`
 *
 * NEXBOT's endpoint. Answers are computed from the live incident store — no
 * external model, no key, works offline. The response can carry a `navigate`
 * route and an `incidentId` the UI turns into action chips.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, assistSchema)
  if (!parsed.success) return parsed.response

  const [incidents, responders] = await Promise.all([listIncidents(), listResponders()])
  return ok(askNexbot(parsed.data.question, incidents, responders))
}
