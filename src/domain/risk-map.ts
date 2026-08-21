import { distanceInMetres } from './dispatch'
import type { Coordinates, Incident, IncidentCategory } from './types'

/**
 * SIGHTLINE — what the incident corpus knows that no individual reporter does.
 *
 * A student who was followed once on the north path thinks it was bad luck. A
 * student followed twice thinks they are unlucky. Neither of them can know
 * that six *other* people reported the same thing, on the same stretch,
 * between nine and midnight, this month — because each of those reports went
 * to the control room and stopped there.
 *
 * This module reads the whole corpus and answers two questions no consumer
 * app can answer, because no consumer app holds the corpus:
 *
 *   1. Where do incidents repeat, at what hours, reported by *different*
 *      people? (`detectPatterns`)
 *   2. Given those patterns, which way should someone walk right now?
 *      (`rankRoutesBySafety`)
 *
 * Everything here is pure, so the reasoning behind a routing suggestion can be
 * unit-tested and defended rather than trusted.
 */

/** Incidents within this radius of each other count as the same stretch. */
export const PATTERN_RADIUS_M = 90

/**
 * A pattern needs this many incidents **from distinct reporters**.
 *
 * The distinct-reporter rule is the important half. One person filing six
 * reports about the same corridor is one person's experience — possibly a real
 * ordeal, possibly a grudge, but not evidence that a place is dangerous for
 * everyone. Routing strangers around it on one account's say-so would let a
 * single user quietly reshape the campus map.
 */
export const MIN_PATTERN_INCIDENTS = 3
export const MIN_DISTINCT_REPORTERS = 2

/** Reports older than this stop influencing routing entirely. */
export const RISK_WINDOW_DAYS = 60

/** Hour bands. Three-hour buckets separate "late evening" from "lunchtime". */
const BAND_HOURS = 3

/** Categories that make a *place* feel unsafe to walk through. */
const PERSONAL_SAFETY_CATEGORIES: readonly IncidentCategory[] = ['harassment', 'security']

export interface RiskPattern {
  id: string
  centre: Coordinates
  /** Inclusive start hour, exclusive end hour, in local time. */
  fromHour: number
  toHour: number
  category: IncidentCategory
  incidentCount: number
  /** Distinct reporters — the number that makes this more than one story. */
  distinctReporters: number
  /** 0–1, recency-weighted. Drives how hard routing avoids this. */
  weight: number
  /** One line a human can check against the incident list. */
  headline: string
}

const hourBand = (hour: number): number => Math.floor(hour / BAND_HOURS) * BAND_HOURS

const pad = (hour: number) => String(hour % 24).padStart(2, '0')

/**
 * How much a report still counts, by age. Linear decay to zero across the
 * window: last week's incident should move someone tonight, last term's
 * should barely register.
 *
 * @example
 * recencyWeight(0, new Date()) // => 1
 */
export function recencyWeight(ageDays: number): number {
  if (ageDays < 0 || ageDays > RISK_WINDOW_DAYS) return 0
  return 1 - ageDays / RISK_WINDOW_DAYS
}

/**
 * Recurring place-and-hour clusters, strongest first.
 *
 * Clusters greedily around the earliest ungrouped incident rather than running
 * k-means: the output has to be explainable to a student who asks "why are you
 * telling me to avoid this path", and a centroid you can point at a map beats
 * a better-fitting cluster nobody can justify.
 *
 * @example
 * detectPatterns(incidents, new Date())[0].headline
 * // => 'North path · 21:00–00:00 · 6 reports from 5 people'
 */
export function detectPatterns(incidents: readonly Incident[], now: Date): RiskPattern[] {
  const relevant = incidents.filter((incident) => {
    if (!PERSONAL_SAFETY_CATEGORIES.includes(incident.category)) return false
    const ageDays = (now.getTime() - new Date(incident.createdAt).getTime()) / 86_400_000
    return ageDays >= 0 && ageDays <= RISK_WINDOW_DAYS
  })

  // Group by (category, hour band) first — a fire at noon and a theft at
  // midnight in the same doorway are not one pattern.
  const buckets = new Map<string, Incident[]>()
  for (const incident of relevant) {
    const band = hourBand(new Date(incident.createdAt).getHours())
    const key = `${incident.category}:${band}`
    buckets.set(key, [...(buckets.get(key) ?? []), incident])
  }

  const patterns: RiskPattern[] = []

  for (const [key, bucket] of buckets) {
    const [category, bandText] = key.split(':')
    const band = Number(bandText)
    const ungrouped = [...bucket].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    while (ungrouped.length > 0) {
      const seed = ungrouped.shift() as Incident
      const cluster = [seed]

      for (let index = ungrouped.length - 1; index >= 0; index -= 1) {
        if (distanceInMetres(seed.location, ungrouped[index].location) <= PATTERN_RADIUS_M) {
          cluster.push(ungrouped.splice(index, 1)[0])
        }
      }

      const reporters = new Set(
        cluster.map((incident) => incident.reporterId ?? `anon:${incident.id}`),
      )
      if (cluster.length < MIN_PATTERN_INCIDENTS || reporters.size < MIN_DISTINCT_REPORTERS) {
        continue
      }

      const centre = {
        lat: cluster.reduce((sum, item) => sum + item.location.lat, 0) / cluster.length,
        lng: cluster.reduce((sum, item) => sum + item.location.lng, 0) / cluster.length,
      }

      const weightSum = cluster.reduce((sum, item) => {
        const ageDays = (now.getTime() - new Date(item.createdAt).getTime()) / 86_400_000
        return sum + recencyWeight(ageDays)
      }, 0)

      // Saturates: eight recent reports and eighty should both read as "avoid",
      // and an unbounded score would let one bad month dominate for ever.
      const weight = Math.min(1, weightSum / 8)
      const place = cluster[0].location.label.split(' · ')[0]

      patterns.push({
        id: `${key}:${centre.lat.toFixed(5)},${centre.lng.toFixed(5)}`,
        centre,
        fromHour: band,
        toHour: band + BAND_HOURS,
        category: category as IncidentCategory,
        incidentCount: cluster.length,
        distinctReporters: reporters.size,
        weight,
        headline: `${place} · ${pad(band)}:00–${pad(band + BAND_HOURS)}:00 · ${cluster.length} reports from ${reporters.size} people`,
      })
    }
  }

  return patterns.sort((a, b) => b.weight - a.weight)
}

/** Whether a pattern is active at a given hour. */
export function activeAtHour(pattern: RiskPattern, hour: number): boolean {
  return hour >= pattern.fromHour && hour < pattern.toHour
}

export interface RoutedPath {
  id: string
  name: string
  path: readonly Coordinates[]
  lit: boolean
}

export interface RouteRisk {
  route: RoutedPath
  /** 0–1. Higher is worse. */
  risk: number
  /** Patterns this route passes through, worst first. */
  passes: RiskPattern[]
  /** Plain-language justification shown to the walker. */
  reason: string
}

/**
 * How exposed a route is at a given hour.
 *
 * A pattern counts against a route when the route passes within its radius,
 * weighted by how strong the pattern is. Unlit routes carry a standing penalty
 * on top, because darkness is a hazard the incident log under-reports — nobody
 * files a report about a light that was already out.
 *
 * @example
 * scoreRoute(route, patterns, 22).risk // => 0.62
 */
export function scoreRoute(
  route: RoutedPath,
  patterns: readonly RiskPattern[],
  atHour: number,
): RouteRisk {
  const passes = patterns
    .filter((pattern) => activeAtHour(pattern, atHour))
    .filter((pattern) =>
      route.path.some((point) => distanceInMetres(point, pattern.centre) <= PATTERN_RADIUS_M * 1.4),
    )
    .sort((a, b) => b.weight - a.weight)

  const patternRisk = Math.min(
    1,
    passes.reduce((sum, pattern) => sum + pattern.weight, 0),
  )
  const darknessPenalty = route.lit ? 0 : 0.25
  const risk = Math.min(1, patternRisk + darknessPenalty)

  return { route, risk, passes, reason: explainRoute(route, passes, risk) }
}

function explainRoute(route: RoutedPath, passes: readonly RiskPattern[], risk: number): string {
  if (passes.length === 0) {
    return route.lit
      ? 'No repeat incidents reported on this route at this hour, and it is lit.'
      : 'No repeat incidents reported here at this hour, but the route is unlit.'
  }

  const worst = passes[0]
  const lead = `${worst.incidentCount} reports from ${worst.distinctReporters} people near this route between ${pad(worst.fromHour)}:00 and ${pad(worst.toHour)}:00.`
  return risk >= 0.5 && !route.lit ? `${lead} It is also unlit.` : lead
}

/**
 * Routes ranked safest first for the hour someone is actually walking.
 *
 * Deliberately returns the ranking rather than a single answer: the shortest
 * way is sometimes worth taking anyway, and a system that hides the option is
 * making a decision that belongs to the person walking.
 *
 * @example
 * rankRoutesBySafety(routes, patterns, 22)[0].route.name // => 'C Block → East Gate'
 */
export function rankRoutesBySafety(
  routes: readonly RoutedPath[],
  patterns: readonly RiskPattern[],
  atHour: number,
): RouteRisk[] {
  return routes.map((route) => scoreRoute(route, patterns, atHour)).sort((a, b) => a.risk - b.risk)
}

/**
 * How risk should be described. Never "safe" — the corpus can only say what
 * has been reported, and telling someone a route is safe is a promise no
 * incident log can keep.
 *
 * @example
 * describeRisk(0.1) // => 'Quiet'
 */
export function describeRisk(risk: number): 'Quiet' | 'Some reports' | 'Avoid if you can' {
  if (risk < 0.2) return 'Quiet'
  if (risk < 0.55) return 'Some reports'
  return 'Avoid if you can'
}

/**
 * The band to show a walker for one scored route.
 *
 * A route whose only mark against it is the standing unlit penalty has had
 * nothing reported on it, so calling it 'Some reports' would be a lie the
 * walker could check against the reason text printed beside it.
 */
export function describeRoute(
  entry: RouteRisk,
): 'Quiet' | 'Unlit' | 'Some reports' | 'Avoid if you can' {
  if (entry.passes.length === 0 && entry.risk > 0) return 'Unlit'
  return describeRisk(entry.risk)
}
