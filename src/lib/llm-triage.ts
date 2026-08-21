import Anthropic from '@anthropic-ai/sdk'
import type { IncidentCategory, Severity } from '@/domain/types'

export interface TriageAssessment {
  category: IncidentCategory
  severity: Severity
  rationale: string
  /** Which engine produced this — shown honestly in the UI. */
  engine: 'claude' | 'rules'
}

const CATEGORIES: IncidentCategory[] = [
  'fire',
  'medical',
  'harassment',
  'infrastructure',
  'security',
  'other',
]
const SEVERITIES: Severity[] = ['P0', 'P1', 'P2', 'P3']

/**
 * Keyword lexicons for the deterministic fallback. Order matters: the first
 * category with a hit wins, and "critical" phrases force an escalation.
 */
const LEXICON: Record<Exclude<IncidentCategory, 'other'>, { match: RegExp; base: Severity }> = {
  fire: { match: /fire|smoke|burning|flames?|gas leak|explosion/i, base: 'P1' },
  medical: { match: /collaps|unconscious|bleeding|not breathing|seizure|injur|faint|chest pain/i, base: 'P1' },
  harassment: { match: /harass|stalk|follow|threat|abus|molest|catcall/i, base: 'P1' },
  infrastructure: { match: /leak|flood|power|electric|broken|crack|elevator|lift stuck|ceiling/i, base: 'P2' },
  security: { match: /theft|stolen|fight|weapon|intru|trespass|vandal|suspicious/i, base: 'P2' },
}

const CRITICAL = /not breathing|unconscious|weapon|trapped|spreading|explosion|severe bleeding/i

/**
 * Deterministic triage — the engine the demo relies on. Same output shape as
 * the Claude path, so the UI never cares which one answered.
 *
 * @example
 * ruleTriage('There is smoke spreading from the chemistry lab')
 * // => { category: 'fire', severity: 'P0', rationale: '…', engine: 'rules' }
 */
export function ruleTriage(text: string): TriageAssessment {
  for (const [category, { match, base }] of Object.entries(LEXICON) as [
    Exclude<IncidentCategory, 'other'>,
    (typeof LEXICON)[keyof typeof LEXICON],
  ][]) {
    if (!match.test(text)) continue

    const critical = CRITICAL.test(text)
    const severity: Severity = critical ? 'P0' : base
    return {
      category,
      severity,
      rationale: critical
        ? `Matched ${category} indicators plus a critical phrase — escalated to P0.`
        : `Matched ${category} indicators — assessed at ${base}.`,
      engine: 'rules',
    }
  }

  return {
    category: 'other',
    severity: 'P3',
    rationale: 'No category indicators matched — filed as informational for human review.',
    engine: 'rules',
  }
}

/**
 * JSON Schema describing a triage assessment. Passed to Claude as a structured
 * output format, which constrains generation to this shape — so the response
 * is schema-valid by construction and there is no malformed-JSON path to
 * defend against.
 */
const TRIAGE_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: CATEGORIES },
    severity: { type: 'string', enum: SEVERITIES },
    rationale: {
      type: 'string',
      description: 'One sentence citing the decisive phrases from the report.',
    },
  },
  required: ['category', 'severity', 'rationale'],
  additionalProperties: false,
} as const

const TRIAGE_SYSTEM_PROMPT =
  'You triage campus emergency reports for a university control room. ' +
  'Assess the category and severity, where P0 is life-threatening and needs an ' +
  'immediate response, P1 is urgent, P2 is routine, and P3 is informational. ' +
  'Prefer over-escalation to under-escalation when a report is ambiguous.'

/**
 * Free-text triage: Claude when `ANTHROPIC_API_KEY` is set, the rules engine
 * otherwise — and the rules engine again if the API call fails for any reason.
 * The demo must never depend on wifi.
 *
 * @example
 * await triageIncidentText('Thick smoke pouring from the Block C stairwell')
 * // => { category: 'fire', severity: 'P0', rationale: '…', engine: 'claude' }
 */
export async function triageIncidentText(text: string): Promise<TriageAssessment> {
  if (!process.env.ANTHROPIC_API_KEY) return ruleTriage(text)

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      // Triage is a short classification, so the cheapest effort tier is the
      // right one — the schema does the structural work, not the reasoning.
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: TRIAGE_OUTPUT_SCHEMA },
      },
      system: TRIAGE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    })

    const block = response.content.find((item) => item.type === 'text')
    if (!block || block.type !== 'text') return ruleTriage(text)

    const parsed = JSON.parse(block.text) as Partial<TriageAssessment>
    // The schema already guarantees these, but a bad response must degrade to
    // the rules engine rather than put an invalid severity on the board.
    if (
      !parsed.category ||
      !CATEGORIES.includes(parsed.category) ||
      !parsed.severity ||
      !SEVERITIES.includes(parsed.severity)
    ) {
      return ruleTriage(text)
    }

    return {
      category: parsed.category,
      severity: parsed.severity,
      rationale: parsed.rationale ?? 'Assessed by Claude.',
      engine: 'claude',
    }
  } catch {
    return ruleTriage(text)
  }
}
