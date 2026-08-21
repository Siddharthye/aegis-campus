import { distanceInMetres } from './dispatch'
import type { Coordinates, Incident, IncidentCategory } from './types'

/**
 * Does this new report describe something already on the board?
 *
 * This is the local fallback for duplicate fusion. The real engine is the
 * FUSION module, which AEGIS calls over HTTP — but the control room must not
 * start filing fifty incidents for one fire just because a module is down or
 * the venue wifi died, so the same decision is reimplemented here in a
 * simpler, fully offline form.
 *
 * It is deliberately more conservative than FUSION: FUSION weighs TF-IDF
 * cosine over the description, this weighs plain token overlap. Fusing two
 * genuinely different emergencies into one is far worse than showing a
 * dispatcher two rows they can merge by eye, so when in doubt this does not
 * fuse.
 */

/** Beyond this, two reports are not the same event however similar the words. */
export const MAX_FUSE_DISTANCE_M = 120

/** Reports more than this far apart in time describe separate events. */
export const FUSE_WINDOW_MS = 30 * 60 * 1000

/** Combined score a candidate must clear to be treated as the same incident. */
export const FUSE_THRESHOLD = 0.62

/**
 * Minimum wording agreement before two reports may fuse at all.
 *
 * Without this, proximity and timing alone (0.45 + 0.20 = 0.65) clear the
 * threshold, so two people filing blank reports from the same corridor a
 * minute apart would merge — even when one means a fire and the other means
 * a fight. The costs are asymmetric: a false negative shows a dispatcher two
 * rows they can merge by eye, a false positive hides one emergency inside
 * another. So some positive evidence is required, never just co-location.
 */
export const MIN_SEMANTIC_SIGNAL = 0.05

/**
 * Weights for the three signals. Space dominates because it is the one that
 * is objectively measured; wording is the weakest signal because two people
 * describing the same fire rarely choose the same nouns.
 */
const WEIGHTS = { spatial: 0.45, temporal: 0.2, semantic: 0.35 } as const

/** Words carrying no distinguishing signal in an emergency report. */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'of', 'to', 'and', 'or',
  'near', 'by', 'from', 'with', 'there', 'here', 'it', 'its', 'this', 'that', 'i', 'we',
  'someone', 'something', 'please', 'help', 'reported', 'report',
])

/**
 * Content words of a report, lowercased and de-duplicated.
 *
 * @example
 * tokenize('Smoke in the Block C stairwell') // => Set { 'smoke', 'block', 'c', 'stairwell' }
 */
export function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !STOPWORDS.has(word))
  return new Set(words)
}

/**
 * Jaccard overlap of two token sets — shared words over total distinct words.
 * Two empty descriptions score 0, not 1: no evidence is not agreement.
 *
 * @example
 * jaccardSimilarity(tokenize('smoke block c'), tokenize('smoke block c stairwell')) // => 0.75
 */
export function jaccardSimilarity(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0

  let shared = 0
  for (const token of a) if (b.has(token)) shared += 1
  return shared / (a.size + b.size - shared)
}

/** One report as the matcher sees it — no ids, no storage concerns. */
export interface IncomingReport {
  category: IncidentCategory
  title: string
  description: string
  location: Coordinates
  at: Date
}

export interface MatchScore {
  incident: Incident
  /** 1 at the same spot, falling to 0 at MAX_FUSE_DISTANCE_M. */
  spatial: number
  /** 1 simultaneous, falling to 0 across FUSE_WINDOW_MS. */
  temporal: number
  /** Token overlap of title + description. */
  semantic: number
  combined: number
  /** Human-readable reason, written into the incident timeline on a fuse. */
  rationale: string
}

/**
 * Scores one candidate incident against an incoming report, or null when a
 * hard rule rules it out entirely.
 *
 * Four hard vetoes come before any scoring, because no amount of similarity
 * on the other axes should overcome them: a resolved incident is closed, a
 * different category is a different emergency, beyond the distance ceiling it
 * is somewhere else, and with no wording agreement at all there is no
 * evidence these are the same event — only that they happened nearby.
 *
 * @example
 * scoreMatch(report, incident, new Date())?.combined // => 0.81
 */
export function scoreMatch(
  report: IncomingReport,
  incident: Incident,
  now: Date,
): MatchScore | null {
  if (incident.status === 'resolved') return null
  if (incident.category !== report.category) return null

  const distanceM = distanceInMetres(report.location, incident.location)
  if (distanceM > MAX_FUSE_DISTANCE_M) return null

  const ageMs = now.getTime() - new Date(incident.createdAt).getTime()
  if (ageMs > FUSE_WINDOW_MS) return null

  const spatial = 1 - distanceM / MAX_FUSE_DISTANCE_M
  const temporal = 1 - Math.max(0, ageMs) / FUSE_WINDOW_MS
  const semantic = jaccardSimilarity(
    tokenize(`${report.title} ${report.description}`),
    tokenize(`${incident.title} ${incident.description}`),
  )

  if (semantic < MIN_SEMANTIC_SIGNAL) return null

  const combined =
    spatial * WEIGHTS.spatial + temporal * WEIGHTS.temporal + semantic * WEIGHTS.semantic

  return {
    incident,
    spatial,
    temporal,
    semantic,
    combined,
    rationale:
      `${Math.round(distanceM)}m away, ${Math.round(ageMs / 60_000)} min after the first report, ` +
      `${Math.round(semantic * 100)}% wording overlap`,
  }
}

/**
 * The open incident this report belongs to, or null to open a new one.
 *
 * Returns the single best candidate above the threshold — never merges into
 * several — so fusion stays a decision a dispatcher can follow.
 *
 * @example
 * findFusionCandidate(report, incidents, new Date())?.incident.id // => 'inc-4f9a12c0'
 */
export function findFusionCandidate(
  report: IncomingReport,
  incidents: readonly Incident[],
  now: Date,
): MatchScore | null {
  const ranked = incidents
    .map((incident) => scoreMatch(report, incident, now))
    .filter((score): score is MatchScore => score !== null && score.combined >= FUSE_THRESHOLD)
    .sort((a, b) => b.combined - a.combined)

  return ranked[0] ?? null
}
