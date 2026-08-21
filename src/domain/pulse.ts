/**
 * PULSE — analytics that output actions. Pure functions over `Incident[]`:
 * no I/O, no framework imports, deterministic given the same inputs. The
 * synthetic-history helper at the bottom exists so a 3-day-old deployment can
 * demonstrate 3 weeks of pattern detection — honestly labelled in the UI.
 */
import { campusGeoJSON } from '@/data/campus'
import { SLA_TARGET_MINUTES, readSla } from './sla'
import type { Incident, IncidentCategory, Severity } from './types'

interface BuildingRef {
  id: string
  name: string
  lat: number
  lng: number
}

/** Footprint centroids, so raw-GPS incidents can be attributed to a building. */
const BUILDINGS: BuildingRef[] = campusGeoJSON.features.map((feature) => {
  const ring = feature.geometry.coordinates[0]
  return {
    id: feature.properties.id,
    name: feature.properties.name,
    lat: ring.reduce((sum, point) => sum + point[1], 0) / ring.length,
    lng: ring.reduce((sum, point) => sum + point[0], 0) / ring.length,
  }
})

const buildingRef = (id: string): BuildingRef =>
  BUILDINGS.find((building) => building.id === id) ?? BUILDINGS[0]

/** Squared-degree distance — only the ordering matters at campus scale. */
function nearestBuildingId(lat: number, lng: number): string {
  let best = BUILDINGS[0]
  let bestDistance = Infinity
  for (const building of BUILDINGS) {
    const distance = (building.lat - lat) ** 2 + (building.lng - lng) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = building
    }
  }
  return best.id
}

const incidentBuildingId = (incident: Incident): string =>
  incident.location.buildingId ?? nearestBuildingId(incident.location.lat, incident.location.lng)

function dominantCategory(list: readonly Incident[]): IncidentCategory {
  const counts = new Map<IncidentCategory, number>()
  for (const incident of list) counts.set(incident.category, (counts.get(incident.category) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

/**
 * 7×24 matrix of incident counts, rows indexed by JS weekday (0 = Sunday),
 * columns by hour of day. Rendering order is the caller's concern.
 *
 * @example
 * heatCalendar(incidents)[2][21] // => incidents reported Tuesdays 21:00–22:00
 */
export function heatCalendar(incidents: readonly Incident[]): number[][] {
  const matrix = Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
  for (const incident of incidents) {
    const created = new Date(incident.createdAt)
    matrix[created.getDay()][created.getHours()] += 1
  }
  return matrix
}

/** One building's incident load, with a week-over-week direction. */
export interface Hotspot {
  buildingId: string
  name: string
  count: number
  dominantCategory: IncidentCategory
  lastWeek: number
  priorWeek: number
  trend: 'up' | 'down' | 'flat'
}

/**
 * Buildings ranked by incident count. Incidents without a `buildingId` are
 * attributed to the nearest footprint centroid, so raw-GPS reports still land
 * somewhere a patrol can be sent.
 *
 * @example
 * hotspotRanking(incidents)[0] // => { buildingId: 'hostel-9', count: 17, trend: 'up', ... }
 */
export function hotspotRanking(incidents: readonly Incident[], now: Date = new Date()): Hotspot[] {
  const groups = new Map<string, Incident[]>()
  for (const incident of incidents) {
    const id = incidentBuildingId(incident)
    groups.set(id, [...(groups.get(id) ?? []), incident])
  }
  const WEEK_MS = 7 * 86_400_000
  return [...groups.entries()]
    .map(([buildingId, list]) => {
      const age = (incident: Incident) => now.getTime() - new Date(incident.createdAt).getTime()
      const lastWeek = list.filter((incident) => age(incident) < WEEK_MS).length
      const priorWeek = list.filter((incident) => age(incident) >= WEEK_MS && age(incident) < 2 * WEEK_MS).length
      const trend: Hotspot['trend'] = lastWeek > priorWeek ? 'up' : lastWeek < priorWeek ? 'down' : 'flat'
      return {
        buildingId,
        name: buildingRef(buildingId).name,
        count: list.length,
        dominantCategory: dominantCategory(list),
        lastWeek,
        priorWeek,
        trend,
      }
    })
    .sort((a, b) => b.count - a.count)
}

/** Mean time-to-resolve for one category, over resolved incidents only. */
export interface CategoryMttr {
  category: IncidentCategory
  resolvedCount: number
  meanMinutes: number
}

/**
 * Mean minutes from report to resolution, per category, slowest first.
 * Categories with no resolved incidents are omitted — a mean of nothing lies.
 *
 * @example
 * mttrByCategory(incidents) // => [{ category: 'infrastructure', resolvedCount: 12, meanMinutes: 34.5 }, ...]
 */
export function mttrByCategory(incidents: readonly Incident[]): CategoryMttr[] {
  const sums = new Map<IncidentCategory, { total: number; n: number }>()
  for (const incident of incidents) {
    if (!incident.resolvedAt) continue
    const minutes = (new Date(incident.resolvedAt).getTime() - new Date(incident.createdAt).getTime()) / 60_000
    const bucket = sums.get(incident.category) ?? { total: 0, n: 0 }
    bucket.total += minutes
    bucket.n += 1
    sums.set(incident.category, bucket)
  }
  return [...sums.entries()]
    .map(([category, { total, n }]) => ({
      category,
      resolvedCount: n,
      meanMinutes: Math.round((total / n) * 10) / 10,
    }))
    .sort((a, b) => b.meanMinutes - a.meanMinutes)
}

/** SLA outcome for one severity band. `rate` is met/total, 1 when empty. */
export interface SlaScore {
  severity: Severity
  met: number
  breached: number
  total: number
  rate: number
}

/**
 * Met/breached counts and rate per severity, always in P0→P3 order. Open
 * incidents count against the clock too — `readSla` keeps it running.
 *
 * @example
 * slaScorecard(incidents)[0] // => { severity: 'P0', met: 3, breached: 1, total: 4, rate: 0.75 }
 */
export function slaScorecard(incidents: readonly Incident[], now: Date = new Date()): SlaScore[] {
  const severities: Severity[] = ['P0', 'P1', 'P2', 'P3']
  return severities.map((severity) => {
    const list = incidents.filter((incident) => incident.severity === severity)
    const breached = list.filter((incident) => readSla(incident, now).breached).length
    const met = list.length - breached
    return { severity, met, breached, total: list.length, rate: list.length === 0 ? 1 : met / list.length }
  })
}

/** A building × 2-hour window that keeps producing incidents. */
export interface PatrolRecommendation {
  buildingId: string
  buildingName: string
  /** e.g. "21:00–23:00" */
  windowLabel: string
  /** e.g. "Tue–Thu" */
  dayLabel: string
  count: number
  /** Cell count over the mean occupied cell — 3.2 reads as "3.2× baseline". */
  multiplier: number
  dominantCategory: IncidentCategory
  headline: string
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0]

function labelDays(days: ReadonlySet<number>): string {
  const ordered = MON_FIRST.filter((day) => days.has(day))
  if (ordered.length === 1) return DAY_NAMES[ordered[0]]
  const positions = ordered.map((day) => MON_FIRST.indexOf(day))
  const contiguous = positions[positions.length - 1] - positions[0] === positions.length - 1
  if (contiguous && ordered.length > 2) return `${DAY_NAMES[ordered[0]]}–${DAY_NAMES[ordered[ordered.length - 1]]}`
  return ordered.map((day) => DAY_NAMES[day]).join('/')
}

/**
 * Recurring (building × 2h-window) clusters, strongest first. Baseline is the
 * mean count across *occupied* cells — averaging in empty cells would make
 * every cluster look apocalyptic. Cells need ≥ 2 incidents to qualify.
 *
 * @example
 * patrolRecommendations(incidents)[0].headline
 * // => "Hostel 9 · Tue–Thu 21:00–23:00 · 3.2× baseline"
 */
export function patrolRecommendations(incidents: readonly Incident[]): PatrolRecommendation[] {
  const cells = new Map<string, Incident[]>()
  for (const incident of incidents) {
    const hour = new Date(incident.createdAt).getHours()
    const key = `${incidentBuildingId(incident)}:${Math.floor(hour / 2)}`
    cells.set(key, [...(cells.get(key) ?? []), incident])
  }
  const occupied = [...cells.values()]
  if (occupied.length === 0) return []
  const baseline = occupied.reduce((sum, list) => sum + list.length, 0) / occupied.length

  return [...cells.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([key, list]) => {
      const [buildingId, windowIndex] = key.split(':')
      const startHour = Number(windowIndex) * 2
      const pad = (hour: number) => String(hour).padStart(2, '0')
      const windowLabel = `${pad(startHour)}:00–${pad(startHour + 2)}:00`
      const dayLabel = labelDays(new Set(list.map((incident) => new Date(incident.createdAt).getDay())))
      const multiplier = Math.round((list.length / baseline) * 10) / 10
      const name = buildingRef(buildingId).name
      return {
        buildingId,
        buildingName: name,
        windowLabel,
        dayLabel,
        count: list.length,
        multiplier,
        dominantCategory: dominantCategory(list),
        headline: `${name} · ${dayLabel} ${windowLabel} · ${multiplier.toFixed(1)}× baseline`,
      }
    })
    .sort((a, b) => b.multiplier - a.multiplier || b.count - a.count)
    .slice(0, 8)
}

/** Deterministic 32-bit PRNG (mulberry32) — same seed, same history, always. */
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

const SIM_TITLES: Record<IncidentCategory, string> = {
  fire: 'Burning smell reported',
  medical: 'Medical assistance requested',
  harassment: 'Harassment reported',
  infrastructure: 'Facilities fault reported',
  security: 'Suspicious activity reported',
  other: 'Assistance requested',
}

const SIM_SEVERITY_WEIGHTS: Array<[Severity, number]> = [['P0', 0.03], ['P1', 0.17], ['P2', 0.45], ['P3', 0.35]]

function pickSeverity(roll: number): Severity {
  let cumulative = 0
  for (const [severity, weight] of SIM_SEVERITY_WEIGHTS) {
    cumulative += weight
    if (roll < cumulative) return severity
  }
  return 'P3'
}

/**
 * ~90 plausible resolved incidents over the trailing 3 weeks, with the two
 * planted patterns PULSE exists to surface: hostel evenings (Tue–Thu biased)
 * and Block C afternoons. Deterministic for a given seed and anchor date —
 * the analytics page merges this with live data and says so in the UI.
 *
 * @example
 * buildDemoHistory(20260821).length // => 90, identical on every call
 */
export function buildDemoHistory(seed: number, until: Date = new Date()): Incident[] {
  const rand = mulberry32(seed)
  const pick = <T,>(options: readonly T[]): T => options[Math.floor(rand() * options.length)]
  const HOSTELS = ['hostel-7', 'hostel-8', 'hostel-9']
  const OTHERS = BUILDINGS.map((building) => building.id).filter(
    (id) => !HOSTELS.includes(id) && id !== 'block-c',
  )
  const allOffsets = Array.from({ length: 21 }, (_, index) => index)
  const midweekOffsets = allOffsets.filter((offset) => {
    const day = new Date(until.getTime() - offset * 86_400_000).getDay()
    return day >= 2 && day <= 4
  })

  return Array.from({ length: 90 }, (_, index): Incident => {
    const pattern = rand()
    let buildingId: string
    let hour: number
    let category: IncidentCategory
    let offset: number
    if (pattern < 0.45) {
      buildingId = pick(HOSTELS)
      hour = 19 + Math.floor(rand() * 5)
      category = pick(['harassment', 'security', 'security', 'infrastructure', 'medical'] as const)
      offset = rand() < 0.65 ? pick(midweekOffsets) : pick(allOffsets)
    } else if (pattern < 0.7) {
      buildingId = 'block-c'
      hour = 13 + Math.floor(rand() * 4)
      category = pick(['medical', 'infrastructure', 'infrastructure', 'fire', 'other'] as const)
      offset = pick(allOffsets)
    } else {
      buildingId = pick(OTHERS)
      hour = 8 + Math.floor(rand() * 14)
      category = pick(['medical', 'infrastructure', 'security', 'harassment', 'fire', 'other'] as const)
      offset = pick(allOffsets)
    }

    const building = buildingRef(buildingId)
    const created = new Date(until.getTime() - offset * 86_400_000)
    created.setHours(hour, Math.floor(rand() * 60), 0, 0)
    if (created.getTime() > until.getTime()) created.setTime(created.getTime() - 86_400_000)
    const severity = pickSeverity(rand())
    // Scatter around the SLA target so the scorecard shows both outcomes.
    const resolutionMinutes = SLA_TARGET_MINUTES[severity] * (0.4 + rand() * 1.1)
    const resolved = new Date(created.getTime() + resolutionMinutes * 60_000)
    const anchored = rand() < 0.7

    return {
      id: `inc-sim-${String(index).padStart(3, '0')}`,
      category,
      severity,
      status: 'resolved',
      title: `${SIM_TITLES[category]} — ${building.name}`,
      description: 'Simulated history entry generated for PULSE analytics demonstration.',
      location: {
        lat: building.lat,
        lng: building.lng,
        label: building.name,
        method: anchored ? 'floor-plan' : 'gps',
        confidence: anchored ? 0.99 : 0.4,
        buildingId,
      },
      reporterId: 'pulse-sim',
      reportCount: 1,
      confidence: 0.6,
      assignedResponderIds: [],
      createdAt: created.toISOString(),
      resolvedAt: resolved.toISOString(),
      timeline: [
        { at: created.toISOString(), actor: 'pulse-sim', action: 'reported', detail: 'Simulated history' },
        { at: resolved.toISOString(), actor: 'pulse-sim', action: 'resolved' },
      ],
      evidence: [],
      isDrill: false,
    }
  })
}
