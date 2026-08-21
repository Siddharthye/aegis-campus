'use client'

import { useMemo, useState } from 'react'
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
import type { RiskPattern, RouteRisk } from '@/domain/risk-map'
import type { SafeWalk } from '@/domain/safe-walk'
import { MapViewport } from '@/components/ui/MapViewport'

/**
 * Campus 25 — the map Safe Walk is built around.
 *
 * Drawn from real coordinates with an equirectangular projection, which is
 * exact enough across 500 metres and needs no tiles, no key and no network.
 *
 * The visual order is deliberate and matches how someone reads a map under
 * stress: ground and water first, then roads, then buildings, then the things
 * that carry meaning — risk, routes, gates, musters — each on its own layer
 * above the base so nothing important is ever competing with scenery.
 */

const VIEW_WIDTH = 900
const PADDING = 0.04

const BLOCK_STYLE: Record<BlockKind, { fill: string; stroke: string; label: string }> = {
  academic: { fill: '#1b2b45', stroke: '#a78bfa', label: 'Academic block' },
  admin: { fill: '#232a38', stroke: '#94a3b8', label: 'Administration' },
  amenity: { fill: '#16302a', stroke: '#10b981', label: 'Amenity' },
  hostel: { fill: '#2d2a17', stroke: '#eab308', label: 'Hostel' },
  utility: { fill: '#1e242e', stroke: '#64748b', label: 'Utility / parking' },
}

interface Projection {
  width: number
  height: number
  toXY(point: Point): { x: number; y: number }
  /** Metres per SVG unit — lets the scale bar be honest. */
  metresPerUnit: number
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
    metresPerUnit: (lngSpan * 111_320) / width,
    toXY: (point) => ({
      x: ((point.lng - minLng) * cosLat * width) / lngSpan,
      y: ((maxLat - point.lat) * height) / latSpan,
    }),
  }
}

/**
 * Block label layout.
 *
 * Half these buildings are narrower than their own names, so a label centred
 * on the footprint spills out over its neighbours — which is what made the map
 * look hand-drawn. A name that does not fit inside its building is moved
 * beneath it instead, and any two labels that still collide are pushed apart
 * vertically. The font is monospace, so the width of a name is simply its
 * length, which is the one thing that makes this measurable without rendering.
 */
const LABEL_FONT_SIZE = 10.5
/** JetBrains Mono advance width, as a fraction of the font size. */
const LABEL_CHAR_RATIO = 0.6
const LABEL_LINE_HEIGHT = 13.5
/** Breathing room required inside a block for its name to sit there. */
const LABEL_INSET = 8

interface PlacedLabel {
  id: string
  name: string
  x: number
  y: number
}

function placeBlockLabels(plan: Projection): PlacedLabel[] {
  const placed: PlacedLabel[] = []

  for (const item of CAMPUS25_BLOCKS) {
    const topLeft = plan.toXY(item.footprint[0])
    const bottomRight = plan.toXY(item.footprint[2])
    const width = Math.abs(bottomRight.x - topLeft.x)
    const textWidth = item.name.length * LABEL_FONT_SIZE * LABEL_CHAR_RATIO

    const centreX = (topLeft.x + bottomRight.x) / 2
    const fits = textWidth + LABEL_INSET <= width

    let y = fits
      ? (topLeft.y + bottomRight.y) / 2 + LABEL_FONT_SIZE / 3
      : Math.max(topLeft.y, bottomRight.y) + LABEL_LINE_HEIGHT

    // Push down past anything already sitting where this wants to go. Blocks
    // are laid out in a fixed order, so this is deterministic.
    for (const other of placed) {
      const apart = Math.abs(other.x - centreX)
      const overlapWidth = (textWidth + other.name.length * LABEL_FONT_SIZE * LABEL_CHAR_RATIO) / 2
      if (apart < overlapWidth && Math.abs(other.y - y) < LABEL_LINE_HEIGHT) {
        y = other.y + LABEL_LINE_HEIGHT
      }
    }

    placed.push({ id: item.id, name: item.name, x: centreX, y })
  }

  return placed
}

/** Where a name for an area belongs: the average of its corners. */
function centroid(points: readonly Point[], plan: Projection) {
  const projected = points.map((point) => plan.toXY(point))
  return {
    x: projected.reduce((sum, point) => sum + point.x, 0) / projected.length,
    y: projected.reduce((sum, point) => sum + point.y, 0) / projected.length,
  }
}

const line = (points: readonly Point[], plan: Projection) =>
  points
    .map((point) => {
      const { x, y } = plan.toXY(point)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

interface Campus25MapProps {
  walks: readonly SafeWalk[]
  /** SIGHTLINE patterns to shade. Empty until the risk snapshot loads. */
  patterns?: readonly RiskPattern[]
  /** Ranked routes; the safest is drawn emphasised. */
  routes?: readonly RouteRisk[]
  /** Called when a block or gate is clicked. Omit to leave the map read-only. */
  onPickDestination?: (destination: string) => void
}

/** What the inspector is currently describing. */
interface Focus {
  title: string
  detail: string
  tone: 'good' | 'warn' | 'danger' | 'neutral'
}

export function Campus25Map({
  walks,
  patterns = [],
  routes = [],
  onPickDestination,
}: Campus25MapProps) {
  const [focus, setFocus] = useState<Focus | null>(null)
  const plan = useMemo(() => {
    const framing = [
      ...CAMPUS25_BOUNDARY,
      ...CAMPUS25_BLOCKS.flatMap((item) => item.footprint),
      ...CAMPUS25_GATES.map((gate) => gate.position),
      ...CAMPUS25_RING_ROAD,
      ...CAMPUS25_TERRAIN.flatMap((item) => item.outline),
    ]
    return project(framing)
  }, [])

  const trails = walks.filter((walk) => walk.status === 'walking' || walk.status === 'escalated')
  const safestId = routes[0]?.route.id ?? null
  const riskById = new Map(routes.map((entry) => [entry.route.id, entry.risk]))
  const scoredById = new Map(routes.map((entry) => [entry.route.id, entry]))

  /** Every hoverable feature reports through here, so only one can be active. */
  const describe = (next: Focus | null) => () => setFocus(next)

  const pick = (destination: string) => () => onPickDestination?.(destination)
  const pickable = onPickDestination !== undefined

  /** A 100m bar, rounded to the nearest sensible round number. */
  const scaleUnits = 100 / plan.metresPerUnit

  return (
    <div className="flex flex-col gap-2.5">
      <MapViewport label="Campus 25 · Patia" className="h-[440px] sm:h-[560px]">
        <svg
          viewBox={`0 0 ${plan.width} ${plan.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Campus 25: pond, ring road, blocks, gates, walking routes with reported-risk shading, muster points and live safe walks"
          className="size-full"
        >
          <defs>
            {/* Ground wash — keeps the campus from reading as a flat cut-out. */}
            <radialGradient id="campus-ground" cx="50%" cy="45%" r="70%">
              <stop offset="0%" stopColor="#101a2c" />
              <stop offset="100%" stopColor="#0a0e17" />
            </radialGradient>
            <linearGradient id="water" x1="0" y1="0" x2="0.6" y2="1">
              <stop offset="0%" stopColor="#12345c" />
              <stop offset="100%" stopColor="#0d243f" />
            </linearGradient>
            {/* Buildings get a soft drop so the cluster reads as raised. */}
            <filter id="block-lift" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow
                dx="0"
                dy="2.5"
                stdDeviation="2.5"
                floodColor="#05070d"
                floodOpacity="0.75"
              />
            </filter>
            <filter id="risk-blur" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
          </defs>

          <rect width={plan.width} height={plan.height} fill="url(#campus-ground)" />

          {/* ── Terrain ─────────────────────────────────────────────────── */}
          {CAMPUS25_TERRAIN.map((item) => {
            const centre = centroid(item.outline, plan)
            const water = item.kind === 'water'
            return (
              <g key={item.id}>
                <polygon
                  points={line(item.outline, plan)}
                  fill={water ? 'url(#water)' : '#14301f'}
                  stroke={water ? '#3b82f6' : '#22c55e'}
                  strokeOpacity={0.35}
                  strokeWidth={1.2}
                />
                <text
                  x={centre.x}
                  y={centre.y}
                  textAnchor="middle"
                  style={{
                    fontSize: 11,
                    fill: water ? '#7dd3fc' : '#86efac',
                    fontFamily: 'var(--font-inter), sans-serif',
                    letterSpacing: '0.02em',
                    pointerEvents: 'none',
                    paintOrder: 'stroke',
                    stroke: '#05070d',
                    strokeWidth: 3,
                    strokeLinejoin: 'round',
                  }}
                >
                  {item.name}
                </text>
              </g>
            )
          })}

          {/* ── Roads: casing then surface, the way a road reads ─────────── */}
          <polyline
            points={line(CAMPUS25_RING_ROAD, plan)}
            fill="none"
            stroke="#0a0e17"
            strokeWidth={11}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <polyline
            points={line(CAMPUS25_RING_ROAD, plan)}
            fill="none"
            stroke="#2b3444"
            strokeWidth={7}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* ── Campus boundary ─────────────────────────────────────────── */}
          <polygon
            points={line(CAMPUS25_BOUNDARY, plan)}
            fill="#a78bfa"
            fillOpacity={0.035}
            stroke="#a78bfa"
            strokeOpacity={0.3}
            strokeWidth={1.4}
            strokeDasharray="8 6"
          />

          {/* ── SIGHTLINE risk, under everything actionable ─────────────── */}
          <g filter="url(#risk-blur)">
            {patterns.map((pattern) => {
              const { x, y } = plan.toXY(pattern.centre)
              return (
                <circle
                  key={pattern.id}
                  cx={x}
                  cy={y}
                  r={26 + pattern.weight * 26}
                  fill="#ef4444"
                  fillOpacity={0.1 + pattern.weight * 0.28}
                />
              )
            })}
          </g>

          {/* Hit targets for the blooms above: a blurred shape is a poor
              hover target, so each pattern gets a crisp invisible circle. */}
          {patterns.map((pattern) => {
            const { x, y } = plan.toXY(pattern.centre)
            return (
              <circle
                key={`${pattern.id}-hit`}
                cx={x}
                cy={y}
                r={26 + pattern.weight * 26}
                fill="transparent"
                className="cursor-help"
                onMouseEnter={describe({
                  title: pattern.headline,
                  detail: `${pattern.category} reports from ${pattern.distinctReporters} different people. One person reporting repeatedly would not appear here.`,
                  tone: 'danger',
                })}
                onMouseLeave={describe(null)}
              />
            )
          })}

          {/* ── Walking routes, weighted by how safe they scored ─────────── */}
          {CAMPUS25_ROUTES.map((route) => {
            const risk = riskById.get(route.id)
            const safest = route.id === safestId
            const stroke =
              risk === undefined
                ? route.lit
                  ? '#10b981'
                  : '#f97316'
                : risk < 0.2
                  ? '#10b981'
                  : risk < 0.55
                    ? '#eab308'
                    : '#ef4444'

            const scored = scoredById.get(route.id)
            const active = focus?.title === route.name

            return (
              <g key={route.id}>
                <polyline
                  points={line(route.path, plan)}
                  fill="none"
                  stroke="#05070d"
                  strokeWidth={safest ? 9 : 7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={line(route.path, plan)}
                  fill="none"
                  stroke={stroke}
                  strokeOpacity={active ? 1 : safest ? 0.95 : 0.6}
                  strokeWidth={active ? (safest ? 7 : 5.5) : safest ? 5 : 3.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={route.lit ? undefined : '9 6'}
                />
                {/* A 3px line is not something anyone can reliably point at. */}
                <polyline
                  points={line(route.path, plan)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={18}
                  strokeLinecap="round"
                  className="cursor-help"
                  onMouseEnter={describe({
                    title: route.name,
                    detail: scored?.reason ?? (route.lit ? 'A lit route.' : 'This route is unlit.'),
                    tone: !scored
                      ? 'neutral'
                      : scored.risk < 0.2
                        ? 'good'
                        : scored.risk < 0.55
                          ? 'warn'
                          : 'danger',
                  })}
                  onMouseLeave={describe(null)}
                />
              </g>
            )
          })}

          {/* ── Blocks ──────────────────────────────────────────────────── */}
          <g filter="url(#block-lift)">
            {CAMPUS25_BLOCKS.map((item) => {
              const style = BLOCK_STYLE[item.kind]
              const active = focus?.title === item.name
              return (
                <polygon
                  key={item.id}
                  points={line(item.footprint, plan)}
                  fill={active ? style.stroke : style.fill}
                  fillOpacity={active ? 0.35 : 1}
                  stroke={style.stroke}
                  strokeOpacity={active ? 1 : 0.55}
                  strokeWidth={active ? 2 : 1.2}
                  role={pickable ? 'button' : undefined}
                  tabIndex={pickable ? 0 : undefined}
                  aria-label={pickable ? `Walk to ${item.name}` : undefined}
                  className={pickable ? 'cursor-pointer' : undefined}
                  onMouseEnter={describe({
                    title: item.name,
                    detail: pickable ? `${style.label}. Click to walk here.` : style.label,
                    tone: 'neutral',
                  })}
                  onMouseLeave={describe(null)}
                  onClick={pick(item.name)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onPickDestination?.(item.name)
                    }
                  }}
                />
              )
            })}
          </g>
          {placeBlockLabels(plan).map(({ id, name, x, y }) => (
            <text
              key={`${id}-label`}
              x={x}
              y={y}
              textAnchor="middle"
              style={{
                fontSize: 10.5,
                fill: '#e2e8f0',
                fontFamily: 'var(--font-jetbrains), monospace',
                fontWeight: 700,
                pointerEvents: 'none',
                paintOrder: 'stroke',
                stroke: '#05070d',
                strokeWidth: 3,
                strokeLinejoin: 'round',
              }}
            >
              {name}
            </text>
          ))}

          {/* ── Off-campus orientation ──────────────────────────────────── */}
          {CAMPUS25_LANDMARKS.map((mark) => {
            const { x, y } = plan.toXY(mark.position)
            return (
              <g key={mark.id} opacity={0.8}>
                <circle cx={x} cy={y} r={2.5} fill="#64748b" />
                <text
                  x={x}
                  y={y - 8}
                  textAnchor="middle"
                  style={{
                    fontSize: 10,
                    fill: '#94a3b8',
                    fontFamily: 'var(--font-inter), sans-serif',
                    paintOrder: 'stroke',
                    stroke: '#0a0e17',
                    strokeWidth: 3,
                    strokeLinejoin: 'round',
                  }}
                >
                  {mark.name}
                </text>
              </g>
            )
          })}

          {/* ── Muster points ───────────────────────────────────────────── */}
          {CAMPUS25_MUSTERS.map((muster) => {
            const { x, y } = plan.toXY(muster.position)
            return (
              <g key={muster.id}>
                <circle
                  cx={x}
                  cy={y}
                  r={14}
                  fill="#10b981"
                  fillOpacity={0.12}
                  stroke="#10b981"
                  strokeOpacity={0.5}
                />
                <path
                  d={`M ${x - 4} ${y} l 3 3 l 5 -6`}
                  fill="none"
                  stroke="#34d399"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <title>{`Muster point — ${muster.name}`}</title>
              </g>
            )
          })}

          {/* ── Gates ───────────────────────────────────────────────────── */}
          {CAMPUS25_GATES.map((gate) => {
            const { x, y } = plan.toXY(gate.position)
            return (
              <g
                key={gate.id}
                role={pickable ? 'button' : undefined}
                tabIndex={pickable ? 0 : undefined}
                aria-label={pickable ? `Walk to ${gate.name}` : undefined}
                className={pickable ? 'cursor-pointer' : undefined}
                onMouseEnter={describe({
                  title: gate.name,
                  detail: pickable
                    ? `Towards ${gate.towards}. Click to walk here.`
                    : `Towards ${gate.towards}.`,
                  tone: 'neutral',
                })}
                onMouseLeave={describe(null)}
                onClick={pick(gate.name)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onPickDestination?.(gate.name)
                  }
                }}
              >
                <rect
                  x={x - 7}
                  y={y - 7}
                  width={14}
                  height={14}
                  rx={3.5}
                  fill="#0a1a28"
                  stroke="#a78bfa"
                  strokeWidth={focus?.title === gate.name ? 2.6 : 1.6}
                />
                <rect x={x - 2.5} y={y - 2.5} width={5} height={5} rx={1} fill="#a78bfa" />
                <text
                  x={x}
                  y={y + 21}
                  textAnchor="middle"
                  style={{
                    fontSize: 10,
                    fill: '#7dd3fc',
                    fontFamily: 'var(--font-jetbrains), monospace',
                    pointerEvents: 'none',
                    paintOrder: 'stroke',
                    stroke: '#05070d',
                    strokeWidth: 3,
                    strokeLinejoin: 'round',
                  }}
                >
                  {gate.name}
                </text>
              </g>
            )
          })}

          {/* ── Live walks, always on top ───────────────────────────────── */}
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
                    stroke={danger ? '#ef4444' : '#a78bfa'}
                    strokeWidth={2.6}
                    strokeDasharray="6 4"
                  />
                )}
                <circle
                  cx={last.x}
                  cy={last.y}
                  r={11}
                  fill={danger ? '#ef4444' : '#a78bfa'}
                  fillOpacity={0.18}
                />
                <circle
                  cx={last.x}
                  cy={last.y}
                  r={5}
                  className={danger ? 'siren-pulse' : ''}
                  fill={danger ? '#ef4444' : '#a78bfa'}
                />
              </g>
            )
          })}

          {/* ── Scale bar ───────────────────────────────────────────────── */}
          <g transform={`translate(16, ${plan.height - 18})`}>
            <line x1={0} y1={0} x2={scaleUnits} y2={0} stroke="#64748b" strokeWidth={2} />
            <line x1={0} y1={-4} x2={0} y2={4} stroke="#64748b" strokeWidth={2} />
            <line x1={scaleUnits} y1={-4} x2={scaleUnits} y2={4} stroke="#64748b" strokeWidth={2} />
            <text
              x={scaleUnits / 2}
              y={-7}
              textAnchor="middle"
              style={{
                fontSize: 9.5,
                fill: '#94a3b8',
                fontFamily: 'var(--font-jetbrains), monospace',
              }}
            >
              100 m
            </text>
          </g>
        </svg>
      </MapViewport>

      <MapInspector focus={focus} pickable={pickable} />

      <MapLegend showRisk={patterns.length > 0} />
    </div>
  )
}

const FOCUS_TONE: Record<Focus['tone'], string> = {
  good: 'border-emerald-400/40 text-emerald-300',
  warn: 'border-amber-400/40 text-amber-300',
  danger: 'border-red-500/40 text-red-300',
  neutral: 'border-ops-border text-ops-text',
}

/**
 * What the pointer is currently over, in words.
 *
 * A fixed strip rather than a floating tooltip: a tooltip that follows the
 * cursor covers the very thing being pointed at, and on a map the surroundings
 * are the information.
 */
function MapInspector({ focus, pickable }: { focus: Focus | null; pickable: boolean }) {
  if (!focus) {
    return (
      <p className="rounded-lg border border-dashed border-ops-border/60 px-3 py-2 text-[11px] leading-relaxed text-ops-faint">
        Point at a route to see why it scored the way it did, or at a red area for the reports
        behind it
        {pickable && ' — click any block or gate to walk there'}.
      </p>
    )
  }

  return (
    <div className={`rounded-lg border bg-ops-bg/40 px-3 py-2 ${FOCUS_TONE[focus.tone]}`}>
      <p className="text-[12px] font-medium">{focus.title}</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-ops-muted">{focus.detail}</p>
    </div>
  )
}

/** Without this the coloured marks are decoration, not information. */
function MapLegend({ showRisk }: { showRisk: boolean }) {
  const kinds: BlockKind[] = ['academic', 'admin', 'amenity', 'utility']

  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-lg border border-ops-border/60 bg-ops-bg/40 px-3 py-2">
      {kinds.map((kind) => (
        <LegendItem key={kind} label={BLOCK_STYLE[kind].label}>
          <span
            className="size-2.5 rounded-[2px] border"
            style={{ background: BLOCK_STYLE[kind].fill, borderColor: BLOCK_STYLE[kind].stroke }}
          />
        </LegendItem>
      ))}
      <LegendItem label="Gate">
        <span className="size-2.5 rounded-[2px] border border-ops-accent bg-[#0a1a28]" />
      </LegendItem>
      <LegendItem label="Muster point">
        <span className="size-2.5 rounded-full border border-emerald-400/60 bg-emerald-400/20" />
      </LegendItem>
      <LegendItem label="Quiet route">
        <span className="h-[3px] w-5 rounded-full bg-emerald-400" />
      </LegendItem>
      {showRisk && (
        <>
          <LegendItem label="Some reports">
            <span className="h-[3px] w-5 rounded-full bg-sev-p2" />
          </LegendItem>
          <LegendItem label="Avoid if you can">
            <span className="h-[3px] w-5 rounded-full bg-sev-p0" />
          </LegendItem>
          <LegendItem label="Reported-risk area">
            <span className="size-2.5 rounded-full bg-sev-p0/40" />
          </LegendItem>
        </>
      )}
      <LegendItem label="Unlit (dashed)">
        <span className="h-[3px] w-5 rounded-full bg-sev-p1/70" />
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
