import { describe, expect, it } from 'vitest'
import {
  MIN_DISTINCT_REPORTERS,
  MIN_PATTERN_INCIDENTS,
  PATTERN_RADIUS_M,
  RISK_WINDOW_DAYS,
  activeAtHour,
  describeRisk,
  describeRoute,
  detectPatterns,
  rankRoutesBySafety,
  recencyWeight,
  scoreRoute,
  type RoutedPath,
} from './risk-map'
import type { Incident, IncidentCategory } from './types'

const CENTRE = { lat: 20.3549, lng: 85.8197 }
/** ~1 metre in degrees of latitude. */
const M = 1 / 111_320
const NOW = new Date('2026-08-21T12:00:00.000Z')

/** An incident at an offset, hour and reporter — the only axes that matter. */
const at = (
  northMetres: number,
  hour: number,
  reporter: string,
  overrides: Partial<Incident> = {},
): Incident =>
  ({
    id: `inc-${northMetres}-${hour}-${reporter}`,
    category: 'harassment' as IncidentCategory,
    severity: 'P1',
    status: 'resolved',
    title: 'Followed on the path',
    description: 'Someone followed me',
    location: {
      lat: CENTRE.lat + northMetres * M,
      lng: CENTRE.lng,
      label: 'North path',
      method: 'map-tap',
      confidence: 0.7,
    },
    reporterId: reporter,
    createdAt: (() => {
      const date = new Date(NOW)
      date.setDate(date.getDate() - 3)
      date.setHours(hour, 0, 0, 0)
      return date.toISOString()
    })(),
    resolvedAt: null,
    ...overrides,
  }) as Incident

const route = (id: string, northMetres: number, lit: boolean): RoutedPath => ({
  id,
  name: id,
  lit,
  path: [
    { lat: CENTRE.lat + northMetres * M, lng: CENTRE.lng },
    { lat: CENTRE.lat + (northMetres + 40) * M, lng: CENTRE.lng },
  ],
})

describe('recencyWeight', () => {
  it('counts a report from today in full and one past the window not at all', () => {
    expect(recencyWeight(0)).toBe(1)
    expect(recencyWeight(RISK_WINDOW_DAYS + 1)).toBe(0)
  })

  it('decays linearly across the window', () => {
    expect(recencyWeight(RISK_WINDOW_DAYS / 2)).toBeCloseTo(0.5, 5)
  })
})

describe('detectPatterns — the distinct-reporter rule', () => {
  it('finds a cluster reported by several different people', () => {
    const incidents = [at(0, 22, 'a'), at(20, 22, 'b'), at(-15, 23, 'c'), at(10, 22, 'd')]
    const [pattern] = detectPatterns(incidents, NOW)

    expect(pattern.incidentCount).toBe(4)
    expect(pattern.distinctReporters).toBe(4)
    expect(pattern.headline).toContain('4 reports from 4 people')
  })

  it('refuses to call one person reporting repeatedly a pattern', () => {
    // The rule that stops a single account rerouting strangers around a place.
    const onePerson = [at(0, 22, 'a'), at(10, 22, 'a'), at(-10, 22, 'a'), at(5, 22, 'a')]
    expect(detectPatterns(onePerson, NOW)).toEqual([])
  })

  it('needs enough incidents, not just enough people', () => {
    const tooFew = [at(0, 22, 'a'), at(10, 22, 'b')]
    expect(tooFew.length).toBeLessThan(MIN_PATTERN_INCIDENTS)
    expect(detectPatterns(tooFew, NOW)).toEqual([])
  })

  it('separates clusters that are far apart', () => {
    const near = [at(0, 22, 'a'), at(15, 22, 'b'), at(-15, 22, 'c')]
    const far = [at(600, 22, 'd'), at(615, 22, 'e'), at(585, 22, 'f')]
    const patterns = detectPatterns([...near, ...far], NOW)

    expect(patterns).toHaveLength(2)
    for (const pattern of patterns) expect(pattern.incidentCount).toBe(3)
  })

  it('separates the same place at different hours', () => {
    const night = [at(0, 22, 'a'), at(10, 22, 'b'), at(-10, 23, 'c')]
    const noon = [at(0, 12, 'd'), at(10, 12, 'e'), at(-10, 13, 'f')]
    const patterns = detectPatterns([...night, ...noon], NOW)

    expect(patterns).toHaveLength(2)
    expect(new Set(patterns.map((pattern) => pattern.fromHour)).size).toBe(2)
  })

  it('ignores categories that do not make a place feel unsafe', () => {
    const leaks = [
      at(0, 22, 'a', { category: 'infrastructure' }),
      at(10, 22, 'b', { category: 'infrastructure' }),
      at(-10, 22, 'c', { category: 'infrastructure' }),
    ]
    expect(detectPatterns(leaks, NOW)).toEqual([])
  })

  it('ignores reports older than the risk window', () => {
    const stale = [at(0, 22, 'a'), at(10, 22, 'b'), at(-10, 22, 'c')].map((incident) => ({
      ...incident,
      createdAt: new Date(NOW.getTime() - (RISK_WINDOW_DAYS + 5) * 86_400_000).toISOString(),
    }))
    expect(detectPatterns(stale, NOW)).toEqual([])
  })

  it('treats anonymous reports as distinct people rather than as one', () => {
    // Anonymity must not collapse six victims into a single unreliable voice.
    const anonymous = [
      at(0, 22, 'x', { reporterId: null }),
      at(10, 22, 'y', { reporterId: null }),
      at(-10, 22, 'z', { reporterId: null }),
    ]
    const [pattern] = detectPatterns(anonymous, NOW)
    expect(pattern.distinctReporters).toBe(3)
  })
})

describe('scoreRoute', () => {
  const patterns = detectPatterns([at(0, 22, 'a'), at(15, 22, 'b'), at(-15, 22, 'c')], NOW)

  it('scores a route through a pattern above a route away from it', () => {
    const through = scoreRoute(route('through', -20, true), patterns, 22)
    const away = scoreRoute(route('away', 900, true), patterns, 22)
    expect(through.risk).toBeGreaterThan(away.risk)
  })

  it('ignores a pattern outside its hours', () => {
    expect(scoreRoute(route('through', -20, true), patterns, 9).risk).toBe(0)
  })

  it('penalises an unlit route even where nothing has been reported', () => {
    // Nobody files a report about a light that was already out.
    expect(scoreRoute(route('dark', 900, false), patterns, 22).risk).toBeGreaterThan(0)
    expect(scoreRoute(route('lit', 900, true), patterns, 22).risk).toBe(0)
  })

  it('explains itself in numbers a walker can check', () => {
    const scored = scoreRoute(route('through', -20, true), patterns, 22)
    expect(scored.reason).toMatch(/\d+ reports from \d+ people/)
  })

  it('never exceeds 1, however many patterns overlap', () => {
    const many = detectPatterns(
      Array.from({ length: 40 }, (_, index) => at(index % 20, 22, `r${index}`)),
      NOW,
    )
    expect(scoreRoute(route('through', 0, false), many, 22).risk).toBeLessThanOrEqual(1)
  })
})

describe('rankRoutesBySafety', () => {
  it('puts the quietest route first', () => {
    const patterns = detectPatterns([at(0, 22, 'a'), at(15, 22, 'b'), at(-15, 22, 'c')], NOW)
    const ranked = rankRoutesBySafety(
      [route('risky', 0, false), route('quiet', 900, true)],
      patterns,
      22,
    )
    expect(ranked[0].route.id).toBe('quiet')
  })

  it('returns every route, so the shorter way is never hidden', () => {
    const routes = [route('a', 0, true), route('b', 900, true), route('c', 1800, false)]
    expect(rankRoutesBySafety(routes, [], 22)).toHaveLength(routes.length)
  })
})

describe('describeRisk', () => {
  it('never promises safety — only what has been reported', () => {
    expect(describeRisk(0.05)).toBe('Quiet')
    expect(describeRisk(0.4)).toBe('Some reports')
    expect(describeRisk(0.8)).toBe('Avoid if you can')
  })
})

describe('describeRoute', () => {
  const patterns = detectPatterns([at(0, 22, 'a'), at(15, 22, 'b'), at(-15, 22, 'c')], NOW)

  it('says unlit rather than implying reports that do not exist', () => {
    const dark = scoreRoute(route('dark', 900, false), patterns, 22)
    expect(dark.passes).toEqual([])
    expect(describeRisk(dark.risk)).toBe('Some reports')
    expect(describeRoute(dark)).toBe('Unlit')
  })

  it('still reports on a route that genuinely passes a pattern', () => {
    const through = scoreRoute(route('through', -20, true), patterns, 22)
    expect(describeRoute(through)).not.toBe('Unlit')
  })

  it('calls a lit route with nothing reported quiet', () => {
    expect(describeRoute(scoreRoute(route('lit', 900, true), patterns, 22))).toBe('Quiet')
  })
})

describe('activeAtHour', () => {
  it('is inclusive of the start hour and exclusive of the end', () => {
    const [pattern] = detectPatterns([at(0, 22, 'a'), at(10, 22, 'b'), at(-10, 23, 'c')], NOW)
    expect(activeAtHour(pattern, pattern.fromHour)).toBe(true)
    expect(activeAtHour(pattern, pattern.toHour)).toBe(false)
  })
})

/** Guards the constants the rules above depend on. */
describe('thresholds', () => {
  it('requires more than one voice and more than a couple of reports', () => {
    expect(MIN_DISTINCT_REPORTERS).toBeGreaterThan(1)
    expect(MIN_PATTERN_INCIDENTS).toBeGreaterThanOrEqual(3)
    expect(PATTERN_RADIUS_M).toBeGreaterThan(0)
  })
})
