import { ok } from '@/lib/http'
import { getPulseSnapshot } from '@/lib/pulse-service'

export const dynamic = 'force-dynamic'

/**
 * `GET /api/pulse`
 *
 * The PULSE analytics snapshot: heat calendar, hotspot ranking, MTTR by
 * category, SLA scorecard, and patrol recommendations. Everything is computed
 * from one merged dataset in a single pass, so no two figures can disagree.
 *
 * @example
 * const pulse = await fetch('/api/pulse').then((r) => r.json())
 * pulse.patrols[0].headline // => 'Hostel 9 · Tue–Thu 21:00–23:00 · 3.2× baseline'
 */
export async function GET() {
  return ok(await getPulseSnapshot())
}
