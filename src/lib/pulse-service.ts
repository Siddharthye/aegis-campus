import {
  buildDemoHistory,
  heatCalendar,
  hotspotRanking,
  mttrByCategory,
  patrolRecommendations,
  slaScorecard,
  type CategoryMttr,
  type Hotspot,
  type PatrolRecommendation,
  type SlaScore,
} from '@/domain/pulse'
import type { Incident } from '@/domain/types'
import { listIncidents } from './incident-service'

/**
 * PULSE service — assembles the analytics payload from live incidents plus a
 * deterministic synthetic history.
 *
 * The synthetic history exists because a three-day-old deployment has no three
 * weeks of pattern to detect, and analytics with nothing in them demonstrate
 * nothing. It is generated from a fixed seed, is identical on every machine,
 * and the UI labels it as simulated — see `simulatedCount` in the payload.
 */

/** Fixed seed, so every machine and every rerun produces the same history. */
const HISTORY_SEED = 20260821

export interface PulseSnapshot {
  /** 7 rows (Sunday first) × 24 hourly columns of incident counts. */
  heatCalendar: number[][]
  hotspots: Hotspot[]
  mttr: CategoryMttr[]
  sla: SlaScore[]
  patrols: PatrolRecommendation[]
  /** Real incidents in the analysis window. */
  liveCount: number
  /** Synthetic history rows blended in, disclosed in the UI. */
  simulatedCount: number
  generatedAt: string
}

/**
 * Every PULSE figure in one pass over one merged dataset, so the heat
 * calendar, hotspots and patrol plan can never disagree with each other.
 *
 * Drill incidents are excluded: a rehearsed emergency is not evidence about
 * where real emergencies happen, and letting drills drive a patrol
 * recommendation would send officers to whichever building we demoed most.
 *
 * @example
 * const pulse = await getPulseSnapshot()
 * pulse.patrols[0].headline // => 'Hostel 9 · Tue–Thu 21:00–23:00 · 3.2× baseline'
 */
export async function getPulseSnapshot(): Promise<PulseSnapshot> {
  const now = new Date()
  const live = await listIncidents({ includeDrills: false })
  const simulated = buildDemoHistory(HISTORY_SEED, now)
  const merged: Incident[] = [...live, ...simulated]

  return {
    heatCalendar: heatCalendar(merged),
    hotspots: hotspotRanking(merged, now),
    mttr: mttrByCategory(merged),
    sla: slaScorecard(merged, now),
    patrols: patrolRecommendations(merged),
    liveCount: live.length,
    simulatedCount: simulated.length,
    generatedAt: now.toISOString(),
  }
}
