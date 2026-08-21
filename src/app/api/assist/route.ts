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
 * route and an `incidentId` the UI turns into action chips, plus `sources`:
 * what was actually read and how long the answer took. The UI shows those
 * numbers because they are the honest version of an "AI is thinking"
 * indicator — this engine's work is measurable, so measure it.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, assistSchema)
  if (!parsed.success) return parsed.response

  const startedAt = Date.now()
  const [incidents, responders] = await Promise.all([listIncidents(), listResponders()])
  const answer = askNexbot(parsed.data.question, incidents, responders)

  return ok({
    ...answer,
    sources: {
      incidents: incidents.length,
      responders: responders.length,
      tookMs: Date.now() - startedAt,
    },
  })
}
