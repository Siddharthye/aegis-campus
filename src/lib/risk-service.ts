import { CAMPUS25_ROUTES } from '@/data/campus25'
import { buildRiskHistory } from '@/data/risk-history'
import {
  detectPatterns,
  rankRoutesBySafety,
  type RiskPattern,
  type RouteRisk,
  type RoutedPath,
} from '@/domain/risk-map'
import type { Incident } from '@/domain/types'
import { listIncidents } from './incident-service'

/**
 * SIGHTLINE service — assembles the corpus and answers the two questions.
 *
 * The corpus is live incidents plus a deterministic simulated history, and the
 * response says how much of each went in, because a routing suggestion built
 * partly on synthetic data has to admit that to be worth trusting.
 */

const ROUTES: readonly RoutedPath[] = CAMPUS25_ROUTES.map((route) => ({
  id: route.id,
  name: route.name,
  path: route.path,
  lit: route.lit,
}))

export interface RiskSnapshot {
  /** Patterns active anywhere, strongest first. */
  patterns: RiskPattern[]
  /** Every route, safest first, scored for the requested hour. */
  routes: RouteRisk[]
  /** The hour the routes were scored for. */
  atHour: number
  liveCount: number
  simulatedCount: number
  generatedAt: string
}

/**
 * Patterns and route rankings for one hour of the day.
 *
 * Drill incidents are excluded: a rehearsed emergency is not evidence about
 * where real ones happen, and letting the Block C fire drill reroute students
 * around Block C every night would be an own goal.
 *
 * @example
 * const risk = await getRiskSnapshot(22)
 * risk.routes[0].route.name // => the safest way to walk at 10pm
 */
export async function getRiskSnapshot(atHour: number): Promise<RiskSnapshot> {
  const now = new Date()
  const live = await listIncidents({ includeDrills: false })
  const simulated = buildRiskHistory(now)
  const corpus: Incident[] = [...live, ...simulated]

  const patterns = detectPatterns(corpus, now)

  return {
    patterns,
    routes: rankRoutesBySafety(ROUTES, patterns, atHour),
    atHour,
    liveCount: live.length,
    simulatedCount: simulated.length,
    generatedAt: now.toISOString(),
  }
}
