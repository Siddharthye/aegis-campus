import { CAMPUS25_ROUTES } from '@/data/campus25'
import { line } from '@/domain/campus-projection'
import type { RouteRisk } from '@/domain/risk-map'
import type { FocusableLayerProps } from './types'

interface RoutesLayerProps extends FocusableLayerProps {
  routes: readonly RouteRisk[]
}

/** Green below this, amber below the next, red above it. */
const QUIET_BELOW = 0.2
const BUSY_BELOW = 0.55

function strokeFor(risk: number | undefined, lit: boolean): string {
  // No score yet: all that is known is whether the lights are on.
  if (risk === undefined) return lit ? '#10b981' : '#f97316'
  if (risk < QUIET_BELOW) return '#10b981'
  if (risk < BUSY_BELOW) return '#eab308'
  return '#ef4444'
}

function toneFor(risk: number | undefined): 'good' | 'warn' | 'danger' | 'neutral' {
  if (risk === undefined) return 'neutral'
  if (risk < QUIET_BELOW) return 'good'
  if (risk < BUSY_BELOW) return 'warn'
  return 'danger'
}

/**
 * The walking routes, weighted by how safe they scored.
 *
 * Each route is three strokes: a dark casing, the coloured surface, and a
 * transparent 18px ribbon on top that exists purely to be pointed at — a
 * 3px line is not something anyone can reliably hit, least of all on a phone.
 *
 * The safest route is drawn heavier than the rest, so the recommendation is
 * legible before any of the text is read.
 */
export function RoutesLayer({ plan, routes, focus, describe }: RoutesLayerProps) {
  const safestId = routes[0]?.route.id ?? null
  const scoredById = new Map(routes.map((entry) => [entry.route.id, entry]))

  return (
    <>
      {CAMPUS25_ROUTES.map((route) => {
        const scored = scoredById.get(route.id)
        const risk = scored?.risk
        const safest = route.id === safestId
        const active = focus?.title === route.name
        const path = line(route.path, plan)

        return (
          <g key={route.id}>
            <polyline
              points={path}
              fill="none"
              stroke="#05070d"
              strokeWidth={safest ? 9 : 7}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={path}
              fill="none"
              stroke={strokeFor(risk, route.lit)}
              strokeOpacity={active ? 1 : safest ? 0.95 : 0.6}
              strokeWidth={active ? (safest ? 7 : 5.5) : safest ? 5 : 3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={route.lit ? undefined : '9 6'}
            />
            <polyline
              points={path}
              fill="none"
              stroke="transparent"
              strokeWidth={18}
              strokeLinecap="round"
              className="cursor-help"
              onMouseEnter={describe({
                title: route.name,
                detail: scored?.reason ?? (route.lit ? 'A lit route.' : 'This route is unlit.'),
                tone: toneFor(risk),
              })}
              onMouseLeave={describe(null)}
            />
          </g>
        )
      })}
    </>
  )
}
