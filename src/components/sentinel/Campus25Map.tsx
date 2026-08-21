'use client'

import { useMemo } from 'react'
import {
  CAMPUS25_BLOCKS,
  CAMPUS25_BOUNDARY,
  CAMPUS25_GATES,
  CAMPUS25_LANDMARKS,
  CAMPUS25_MUSTERS,
  CAMPUS25_RING_ROAD,
  CAMPUS25_ROUTES,
  CAMPUS25_TERRAIN,
  type BlockKind,
  type Point,
} from '@/data/campus25'
import type { SafeWalk } from '@/domain/safe-walk'
import { MapViewport } from '@/components/ui/MapViewport'

/**
 * Campus 25, drawn from real coordinates.
 *
 * An equirectangular projection is exact enough across 500 metres and needs no
 * map library, no tiles and no network — which is what lets this work with the
 * wifi off. Everything on it is a place a student can name: Narendra Pond, the
 * archery field, KP-25, the ring road, the gates, and the lit routes between
 * them.
 */

const VIEW_WIDTH = 900

/** Just enough padding to keep edge labels inside the frame. */
const PADDING = 0.04

const BLOCK_STYLE: Record<BlockKind, { fill: string; stroke: string; label: string }> = {
  academic: { fill: 'rgb(56 189 248 / 0.16)', stroke: 'rgb(56 189 248 / 0.6)', label: 'Academic block' },
  admin: { fill: 'rgb(148 163 184 / 0.18)', stroke: 'rgb(148 163 184 / 0.55)', label: 'Administration' },
  amenity: { fill: 'rgb(16 185 129 / 0.16)', stroke: 'rgb(16 185 129 / 0.5)', label: 'Amenity' },
  hostel: { fill: 'rgb(234 179 8 / 0.16)', stroke: 'rgb(234 179 8 / 0.5)', label: 'Hostel' },
  utility: { fill: 'rgb(100 116 139 / 0.16)', stroke: 'rgb(100 116 139 / 0.5)', label: 'Utility / parking' },
}

interface Projection {
  width: number
  height: number
  toXY(point: Point): { x: number; y: number }
}

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

const path = (points: readonly Point[], plan: Projection) =>
  points
    .map((point) => {
      const { x, y } = plan.toXY(point)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

export function Campus25Map({ walks }: { walks: readonly SafeWalk[] }) {
  const plan = useMemo(() => {
    const framing = [
      ...CAMPUS25_BOUNDARY,
      ...CAMPUS25_BLOCKS.flatMap((item) => item.footprint),
      ...CAMPUS25_GATES.map((gate) => gate.position),
      ...CAMPUS25_RING_ROAD,
      // The pond is the orientation cue people navigate by, so it stays in
      // frame; the archery field and KP-25 are drawn but are not allowed to
      // stretch the bounds and shrink the campus to a smudge.
      ...(CAMPUS25_TERRAIN.find((item) => item.id === 'narendra-pond')?.outline ?? []),
    ]
    return project(framing)
  }, [])

  const trails = walks.filter((walk) => walk.status === 'walking' || walk.status === 'escalated')

  return (
    <div className="flex flex-col gap-2.5">
      <MapViewport label="Campus 25 · Patia" className="h-[440px] sm:h-[560px]">
        <svg
          viewBox={`0 0 ${plan.width} ${plan.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Campus 25 map: pond, ring road, blocks, gates, lit routes, muster points and live safe walks"
          className="size-full"
        >
          {/* Water and open ground first — everything else sits on top. */}
          {CAMPUS25_TERRAIN.map((item) => {
            const centre = plan.toXY(item.outline[0])
            return (
              <g key={item.id}>
                <polygon
                  points={path(item.outline, plan)}
                  fill={item.kind === 'water' ? 'rgb(30 64 175 / 0.35)' : 'rgb(22 101 52 / 0.28)'}
                  stroke={item.kind === 'water' ? 'rgb(59 130 246 / 0.5)' : 'rgb(34 197 94 / 0.4)'}
                  strokeWidth={1.2}
                />
                <text
                  x={centre.x + 30}
                  y={centre.y + 26}
                  style={{
                    fontSize: 11,
                    fill: item.kind === 'water' ? 'rgb(147 197 253)' : 'rgb(134 239 172)',
                    fontFamily: 'var(--font-inter), sans-serif',
                  }}
                >
                  {item.name}
                </text>
              </g>
            )
          })}

          {/* Ring road. */}
          <polyline
            points={path(CAMPUS25_RING_ROAD, plan)}
            fill="none"
            stroke="rgb(100 116 139 / 0.55)"
            strokeWidth={7}
            strokeLinejoin="round"
          />

          {/* Campus land. */}
          <polygon
            points={path(CAMPUS25_BOUNDARY, plan)}
            fill="rgb(15 23 42 / 0.6)"
            stroke="rgb(56 189 248 / 0.3)"
            strokeWidth={1.5}
            strokeDasharray="7 5"
          />

          {/* Off-campus orientation marks. */}
          {CAMPUS25_LANDMARKS.map((mark) => {
            const { x, y } = plan.toXY(mark.position)
            return (
              <g key={mark.id}>
                <circle cx={x} cy={y} r={3} fill="rgb(148 163 184)" />
                <text
                  x={x}
                  y={y - 8}
                  textAnchor="middle"
                  style={{ fontSize: 10.5, fill: 'rgb(148 163 184)', fontFamily: 'var(--font-inter), sans-serif' }}
                >
                  {mark.name}
                </text>
              </g>
            )
          })}

          {/* Walking routes. */}
          {CAMPUS25_ROUTES.map((route) => (
            <polyline
              key={route.id}
              points={path(route.path, plan)}
              fill="none"
              stroke={route.lit ? 'rgb(16 185 129 / 0.65)' : 'rgb(249 115 22 / 0.6)'}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={route.lit ? undefined : '8 6'}
            />
          ))}

          {/* Blocks. */}
          {CAMPUS25_BLOCKS.map((item) => {
            const centre = plan.toXY({
              lat: (item.footprint[0].lat + item.footprint[2].lat) / 2,
              lng: (item.footprint[0].lng + item.footprint[2].lng) / 2,
            })
            const style = BLOCK_STYLE[item.kind]
            return (
              <g key={item.id}>
                <polygon
                  points={path(item.footprint, plan)}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={1.3}
                />
                <text
                  x={centre.x}
                  y={centre.y + 3.5}
                  textAnchor="middle"
                  style={{
                    fontSize: 11,
                    fill: 'rgb(226 232 240)',
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
                <circle cx={x} cy={y} r={15} fill="rgb(16 185 129 / 0.14)" stroke="rgb(16 185 129 / 0.55)" />
                <circle cx={x} cy={y} r={4} fill="rgb(52 211 153)" />
                <text
                  x={x}
                  y={y - 20}
                  textAnchor="middle"
                  style={{ fontSize: 10.5, fill: 'rgb(52 211 153)', fontFamily: 'var(--font-jetbrains), monospace' }}
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
                  x={x - 7}
                  y={y - 7}
                  width={14}
                  height={14}
                  rx={3}
                  fill="rgb(56 189 248 / 0.25)"
                  stroke="rgb(56 189 248 / 0.9)"
                  strokeWidth={1.4}
                />
                <text
                  x={x}
                  y={y + 22}
                  textAnchor="middle"
                  style={{ fontSize: 10.5, fill: 'rgb(56 189 248)', fontFamily: 'var(--font-jetbrains), monospace' }}
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
                    strokeWidth={2.6}
                    strokeDasharray="6 4"
                  />
                )}
                <circle
                  cx={last.x}
                  cy={last.y}
                  r={7}
                  className={danger ? 'siren-pulse' : ''}
                  fill={danger ? 'rgb(239 68 68)' : 'rgb(56 189 248)'}
                />
              </g>
            )
          })}
        </svg>
      </MapViewport>

      <MapLegend />
    </div>
  )
}

/** Without this the coloured boxes are decoration, not information. */
function MapLegend() {
  const blockKinds: BlockKind[] = ['academic', 'admin', 'amenity', 'utility']

  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-lg border border-ops-border/60 bg-ops-bg/40 px-3 py-2">
      {blockKinds.map((kind) => (
        <LegendItem key={kind} label={BLOCK_STYLE[kind].label}>
          <span
            className="size-2.5 rounded-[2px] border"
            style={{ background: BLOCK_STYLE[kind].fill, borderColor: BLOCK_STYLE[kind].stroke }}
          />
        </LegendItem>
      ))}

      <LegendItem label="Gate">
        <span className="size-2.5 rounded-[2px] border border-ops-accent bg-ops-accent/25" />
      </LegendItem>
      <LegendItem label="Muster point">
        <span className="size-2.5 rounded-full bg-emerald-400" />
      </LegendItem>
      <LegendItem label="Lit route">
        <span className="h-0.5 w-4 rounded-full bg-emerald-400/70" />
      </LegendItem>
      <LegendItem label="Unlit route">
        <span className="h-0.5 w-4 rounded-full bg-sev-p1/70 [background-image:repeating-linear-gradient(90deg,currentColor_0_3px,transparent_3px_6px)]" />
      </LegendItem>
      <LegendItem label="Water">
        <span className="size-2.5 rounded-[2px] border border-blue-400/50 bg-blue-700/40" />
      </LegendItem>
      <LegendItem label="Live walk">
        <span className="size-2.5 rounded-full bg-ops-accent" />
      </LegendItem>
    </div>
  )
}

function LegendItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      {children}
      <span className="ops-label text-ops-faint">{label}</span>
    </span>
  )
}
