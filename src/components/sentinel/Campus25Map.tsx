'use client'

import { useMemo } from 'react'
import {
  CAMPUS25_BLOCKS,
  CAMPUS25_BOUNDARY,
  CAMPUS25_GATES,
  CAMPUS25_LANDMARKS,
  CAMPUS25_MUSTERS,
  CAMPUS25_ROUTES,
  type BlockKind,
  type Point,
} from '@/data/campus25'
import type { SafeWalk } from '@/domain/safe-walk'

/**
 * Campus 25, drawn from real coordinates.
 *
 * An equirectangular projection is exact enough across 400 metres and needs no
 * map library, no tiles and no network — which is what lets the safe-walk map
 * work in a basement stairwell. Everything on it is a place a student can
 * name: the gates, the block cluster, the lit routes, the muster points, and
 * the off-campus landmarks people actually orient by.
 */

const VIEW_WIDTH = 760
const PADDING = 0.12

const BLOCK_FILL: Record<BlockKind, string> = {
  academic: 'rgb(56 189 248 / 0.14)',
  admin: 'rgb(148 163 184 / 0.16)',
  amenity: 'rgb(16 185 129 / 0.14)',
  hostel: 'rgb(234 179 8 / 0.14)',
  utility: 'rgb(100 116 139 / 0.14)',
}

const BLOCK_STROKE: Record<BlockKind, string> = {
  academic: 'rgb(56 189 248 / 0.5)',
  admin: 'rgb(148 163 184 / 0.5)',
  amenity: 'rgb(16 185 129 / 0.45)',
  hostel: 'rgb(234 179 8 / 0.45)',
  utility: 'rgb(100 116 139 / 0.45)',
}

interface Projection {
  width: number
  height: number
  toXY(point: Point): { x: number; y: number }
}

/** Frames every campus point, scaling longitude by cos(lat) so shapes hold. */
function project(points: readonly Point[], width = VIEW_WIDTH): Projection {
  const lats = points.map((point) => point.lat)
  const lngs = points.map((point) => point.lng)

  const latSpanRaw = Math.max(...lats) - Math.min(...lats)
  const lngSpanRaw = Math.max(...lngs) - Math.min(...lngs)
  const minLat = Math.min(...lats) - latSpanRaw * PADDING
  const maxLat = Math.max(...lats) + latSpanRaw * PADDING
  const minLng = Math.min(...lngs) - lngSpanRaw * PADDING
  const maxLng = Math.max(...lngs) + lngSpanRaw * PADDING

  const cosLat = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
  const lngSpan = (maxLng - minLng) * cosLat
  const latSpan = maxLat - minLat
  const height = Math.round(width * (latSpan / lngSpan))

  return {
    width,
    height,
    toXY: (point) => ({
      x: ((point.lng - minLng) * cosLat * width) / lngSpan,
      y: ((maxLat - point.lat) * height) / latSpan,
    }),
  }
}

const polygon = (points: readonly Point[], plan: Projection) =>
  points
    .map((point) => {
      const { x, y } = plan.toXY(point)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

interface Campus25MapProps {
  walks: readonly SafeWalk[]
  /** Highlights one route while the walker is choosing a destination. */
  highlightRouteId?: string | null
}

export function Campus25Map({ walks, highlightRouteId = null }: Campus25MapProps) {
  const plan = useMemo(() => {
    const everything = [
      ...CAMPUS25_BOUNDARY,
      ...CAMPUS25_BLOCKS.flatMap((item) => item.footprint),
      ...CAMPUS25_GATES.map((gate) => gate.position),
      ...CAMPUS25_LANDMARKS.map((mark) => mark.position),
    ]
    return project(everything)
  }, [])

  const trails = walks.filter((walk) => walk.status === 'walking' || walk.status === 'escalated')

  return (
    <svg
      viewBox={`0 0 ${plan.width} ${plan.height}`}
      role="img"
      aria-label="Campus 25 map with gates, lit routes, muster points and live safe walks"
      className="w-full rounded-xl border border-ops-border/70 bg-ops-bg"
    >
      {/* Campus land. */}
      <polygon
        points={polygon(CAMPUS25_BOUNDARY, plan)}
        fill="rgb(15 23 42 / 0.75)"
        stroke="rgb(56 189 248 / 0.28)"
        strokeWidth={1.4}
        strokeDasharray="6 4"
      />

      {/* Off-campus orientation marks, drawn faint and outside the fence. */}
      {CAMPUS25_LANDMARKS.map((mark) => {
        const { x, y } = plan.toXY(mark.position)
        return (
          <g key={mark.id} opacity={0.6}>
            <circle cx={x} cy={y} r={2.5} fill="rgb(100 116 139)" />
            <text
              x={x}
              y={y - 7}
              textAnchor="middle"
              style={{ fontSize: 9, fill: 'rgb(139 149 167)', fontFamily: 'var(--font-inter), sans-serif' }}
            >
              {mark.name}
            </text>
          </g>
        )
      })}

      {/* Lit and unlit walking routes. */}
      {CAMPUS25_ROUTES.map((route) => (
        <polyline
          key={route.id}
          points={polygon(route.path, plan)}
          fill="none"
          stroke={route.lit ? 'rgb(16 185 129 / 0.55)' : 'rgb(249 115 22 / 0.5)'}
          strokeWidth={highlightRouteId === route.id ? 5 : 3}
          strokeLinecap="round"
          strokeDasharray={route.lit ? undefined : '7 5'}
        />
      ))}

      {/* Blocks. */}
      {CAMPUS25_BLOCKS.map((item) => {
        const centre = plan.toXY({
          lat: (item.footprint[0].lat + item.footprint[2].lat) / 2,
          lng: (item.footprint[0].lng + item.footprint[2].lng) / 2,
        })
        return (
          <g key={item.id}>
            <polygon
              points={polygon(item.footprint, plan)}
              fill={BLOCK_FILL[item.kind]}
              stroke={BLOCK_STROKE[item.kind]}
              strokeWidth={1}
              rx={2}
            />
            <text
              x={centre.x}
              y={centre.y + 3}
              textAnchor="middle"
              style={{
                fontSize: 10,
                fill: 'rgb(203 213 225)',
                fontFamily: 'var(--font-jetbrains), monospace',
                fontWeight: 700,
              }}
            >
              {item.name}
            </text>
          </g>
        )
      })}

      {/* Muster points. */}
      {CAMPUS25_MUSTERS.map((muster) => {
        const { x, y } = plan.toXY(muster.position)
        return (
          <g key={muster.id}>
            <circle cx={x} cy={y} r={13} fill="rgb(16 185 129 / 0.12)" stroke="rgb(16 185 129 / 0.5)" />
            <circle cx={x} cy={y} r={3.5} fill="rgb(52 211 153)" />
            <text
              x={x}
              y={y - 18}
              textAnchor="middle"
              style={{ fontSize: 9.5, fill: 'rgb(52 211 153)', fontFamily: 'var(--font-jetbrains), monospace' }}
            >
              {muster.name}
            </text>
          </g>
        )
      })}

      {/* Gates. */}
      {CAMPUS25_GATES.map((gate) => {
        const { x, y } = plan.toXY(gate.position)
        return (
          <g key={gate.id}>
            <rect
              x={x - 6}
              y={y - 6}
              width={12}
              height={12}
              rx={2.5}
              fill="rgb(56 189 248 / 0.2)"
              stroke="rgb(56 189 248 / 0.8)"
              strokeWidth={1.2}
            />
            <text
              x={x}
              y={y + 19}
              textAnchor="middle"
              style={{ fontSize: 9.5, fill: 'rgb(56 189 248)', fontFamily: 'var(--font-jetbrains), monospace' }}
            >
              {gate.name}
            </text>
          </g>
        )
      })}

      {/* Live walks. */}
      {trails.map((walk) => {
        const points = walk.path.map((point) => plan.toXY(point))
        if (points.length === 0) return null
        const last = points[points.length - 1]
        const danger = walk.status === 'escalated'

        return (
          <g key={walk.id}>
            {points.length > 1 && (
              <polyline
                points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="none"
                stroke={danger ? 'rgb(239 68 68)' : 'rgb(56 189 248)'}
                strokeWidth={2.4}
                strokeDasharray="5 4"
              />
            )}
            <circle
              cx={last.x}
              cy={last.y}
              r={6}
              className={danger ? 'siren-pulse' : ''}
              fill={danger ? 'rgb(239 68 68)' : 'rgb(56 189 248)'}
            />
          </g>
        )
      })}
    </svg>
  )
}
