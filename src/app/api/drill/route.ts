import { DRILL_SCENARIOS } from '@/data/scenarios'
import { getActiveDrill, listDrillRuns, resetDrills, startDrill } from '@/lib/drill-service'
import { fail, ok, parseBody } from '@/lib/http'
import { startDrillSchema } from '@/lib/drill-schemas'

export const dynamic = 'force-dynamic'

/**
 * `GET /api/drill`
 *
 * The scenario catalogue plus the currently running drill, if any. The control
 * room calls this once on mount to populate the drill panel.
 */
export async function GET() {
  const [active, runs] = await Promise.all([getActiveDrill(), listDrillRuns()])
  const scenarios = DRILL_SCENARIOS.map(({ id, name, description, steps }) => ({
    id,
    name,
    description,
    stepCount: steps.length,
  }))

  return ok({ scenarios, active, runs })
}

/**
 * `POST /api/drill { scenario, speed }`
 *
 * Starts a scenario. Playback is deterministic and fully offline: the same
 * scenario produces the same incidents, in the same order, every time.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, startDrillSchema)
  if (!parsed.success) return parsed.response

  const started = await startDrill(parsed.data.scenario, parsed.data.speed)
  if (!started) return fail('Unknown scenario', 404)

  return ok({ run: started.run, scenario: started.scenario }, 201)
}

/** `DELETE /api/drill` — clears every drill run and its incidents. */
export async function DELETE() {
  await resetDrills()
  return ok({ cleared: true })
}
