import { z } from 'zod'
import { ok, parseBody } from '@/lib/http'
import { triageIncidentText } from '@/lib/llm-triage'

export const dynamic = 'force-dynamic'

const triageRequestSchema = z.object({
  text: z.string().min(3).max(2000),
})

/**
 * `POST /api/triage { text }`
 *
 * Free-text triage assist: category + severity + a one-sentence rationale.
 * Uses Claude (`claude-opus-5`) when `ANTHROPIC_API_KEY` is set; otherwise —
 * and on any API failure — a deterministic rules engine with the same output
 * shape. The response says which engine answered.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, triageRequestSchema)
  if (!parsed.success) return parsed.response

  return ok(await triageIncidentText(parsed.data.text))
}
