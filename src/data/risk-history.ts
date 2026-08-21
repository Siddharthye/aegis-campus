import { CAMPUS25_ROUTES } from './campus25'
import type { Incident, IncidentCategory } from '@/domain/types'

/**
 * Deterministic incident history for SIGHTLINE.
 *
 * A three-day-old deployment has no three months of reports, and pattern
 * detection with nothing to detect demonstrates nothing. This generates a
 * plausible corpus along the real route corridors, from a fixed seed, so the
 * same patterns appear on every machine and can be reconciled against the
 * incident list a reader is shown.
 *
 * It is labelled as simulated everywhere it surfaces. The planted patterns are
 * the ones SIGHTLINE exists to find: a run of harassment reports on the unlit
 * north path late at night, from *different* reporters, and a thinner cluster
 * of security reports by the east gate.
 */

/** Same seed on every machine — see the note in `domain/pulse.ts`. */
const RISK_SEED = 20260821

/** mulberry32: small, fast, and identical across runtimes. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

interface PlantedCluster {
  routeId: string
  /** Where along the route, 0–1. */
  at: number
  category: IncidentCategory
  /** Local hours the cluster occupies. */
  fromHour: number
  toHour: number
  reports: number
  /** Distinct reporters. Fewer than reports means someone reported twice. */
  reporters: number
  label: string
  descriptions: readonly string[]
}

/**
 * The patterns a campus safety officer would want surfaced.
 *
 * The north path is the honest headline: it is the route AEGIS already marks
 * unlit, and the reports concentrate exactly where a walker would be least
 * visible.
 */
const PLANTED: readonly PlantedCluster[] = [
  {
    routeId: 'north-link',
    at: 0.55,
    category: 'harassment',
    fromHour: 21,
    toHour: 24,
    reports: 7,
    reporters: 6,
    label: 'North path · between B Block and the North Gate',
    descriptions: [
      'Man followed me from the block towards the gate',
      'Someone followed me along the unlit stretch near the gate',
      'Followed on the north path, no lights working',
      'A man walked behind me the whole way to the north gate',
      'Felt followed on the dark stretch past B Block',
      'Someone trailed me near the north gate again',
      'Followed near the north gate, second time this month',
    ],
  },
  {
    routeId: 'east-link',
    at: 0.7,
    category: 'security',
    fromHour: 18,
    toHour: 21,
    reports: 4,
    reporters: 3,
    label: 'East gate approach',
    descriptions: [
      'Group loitering by the east gate, made comments',
      'Strangers hanging around the east gate approach',
      'Someone loitering near the east gate after dark',
      'Group by the east gate again this evening',
    ],
  },
  {
    routeId: 'main-spine',
    at: 0.3,
    category: 'security',
    fromHour: 12,
    toHour: 15,
    reports: 3,
    reporters: 1,
    label: 'Main spine · midday',
    descriptions: [
      'Bag went missing near the spine',
      'Think someone took my phone here',
      'Another theft on the spine',
    ],
  },
]

/** Interpolates a point along a route path at fraction `at`. */
function pointAlong(routeId: string, at: number): { lat: number; lng: number } {
  const route = CAMPUS25_ROUTES.find((item) => item.id === routeId) ?? CAMPUS25_ROUTES[0]
  const span = route.path.length - 1
  const index = Math.min(span - 1, Math.floor(at * span))
  const local = at * span - index
  const from = route.path[index]
  const to = route.path[index + 1]

  return {
    lat: from.lat + (to.lat - from.lat) * local,
    lng: from.lng + (to.lng - from.lng) * local,
  }
}

/**
 * The simulated risk corpus: resolved incidents spread across the trailing
 * weeks, concentrated into the planted clusters.
 *
 * Reporter ids repeat within a cluster only where the cluster deliberately has
 * fewer reporters than reports — that is how the "3 reports, 1 person" case
 * gets exercised, which SIGHTLINE must refuse to treat as a pattern.
 *
 * @example
 * buildRiskHistory(new Date()).length // => 14, identical on every call
 */
export function buildRiskHistory(until: Date = new Date()): Incident[] {
  const rand = mulberry32(RISK_SEED)
  const incidents: Incident[] = []

  PLANTED.forEach((cluster, clusterIndex) => {
    const centre = pointAlong(cluster.routeId, cluster.at)

    for (let index = 0; index < cluster.reports; index += 1) {
      // Scatter within ~35m so the cluster is tight but not a single pixel.
      const jitterLat = (rand() - 0.5) * 0.0006
      const jitterLng = (rand() - 0.5) * 0.0006

      const daysAgo = Math.floor(rand() * 40)
      const created = new Date(until.getTime() - daysAgo * 86_400_000)
      const hourSpan = cluster.toHour - cluster.fromHour
      created.setHours(
        cluster.fromHour + Math.floor(rand() * hourSpan),
        Math.floor(rand() * 60),
        0,
        0,
      )
      if (created.getTime() > until.getTime()) {
        created.setTime(created.getTime() - 86_400_000)
      }

      const reporterIndex = index % cluster.reporters
      const resolved = new Date(created.getTime() + (20 + rand() * 40) * 60_000)

      incidents.push({
        id: `inc-risk-${clusterIndex}-${index}`,
        category: cluster.category,
        severity: cluster.category === 'harassment' ? 'P1' : 'P2',
        status: 'resolved',
        title: cluster.descriptions[index % cluster.descriptions.length],
        description: cluster.descriptions[index % cluster.descriptions.length],
        location: {
          lat: centre.lat + jitterLat,
          lng: centre.lng + jitterLng,
          label: cluster.label,
          method: 'map-tap',
          confidence: 0.7,
        },
        reporterId: `risk-sim-${clusterIndex}-${reporterIndex}`,
        reportCount: 1,
        confidence: 0.6,
        assignedResponderIds: [],
        createdAt: created.toISOString(),
        resolvedAt: resolved.toISOString(),
        timeline: [
          { at: created.toISOString(), actor: 'risk-sim', action: 'reported', detail: 'Simulated history' },
          { at: resolved.toISOString(), actor: 'risk-sim', action: 'resolved' },
        ],
        evidence: [],
        isDrill: false,
      })
    }
  })

  return incidents
}
