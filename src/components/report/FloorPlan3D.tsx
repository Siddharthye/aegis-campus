'use client'

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useMemo, useRef, useState } from 'react'
import {
  FLOOR_CORRIDORS,
  FLOOR_WINGS,
  noteForFloor,
  spacesForFloor,
  type FloorId,
  type FloorSpace,
  type SpaceKind,
} from '@/data/floorplan'
import { MapViewport } from '@/components/ui/MapViewport'

/**
 * The Campus 25 second floor, as an interactive isometric model.
 *
 * Built as tilted, extruded SVG rather than a WebGL scene: the floor is ~90
 * flat rectangles, which a 3D engine would render no better and which must
 * work with the wifi off and on a weak laptop. Tilt and rotation are CSS 3D
 * transforms on one container, so panning the whole plan costs one composited
 * transform rather than ninety re-layouts.
 *
 * Picking a room here is a *location*, not a decoration — it becomes the
 * incident's position at room-level precision — the difference between
 * dispatching to a building and dispatching to a door.
 */

/** Plan space is 0–100; the SVG viewBox matches so nothing needs scaling. */
const PLAN_SIZE = 100

/** Extrusion depth per space, in plan units. Walls read as height. */
const WALL_DEPTH = 1.6

const KIND_STYLE: Record<SpaceKind, { fill: string; stroke: string; label: string }> = {
  room: { fill: 'rgb(30 41 59 / 0.9)', stroke: 'rgb(71 85 105)', label: 'Rooms' },
  lecture: { fill: 'rgb(167 139 250 / 0.16)', stroke: 'rgb(167 139 250 / 0.55)', label: 'Lecture theatres' },
  office: { fill: 'rgb(167 139 250 / 0.1)', stroke: 'rgb(167 139 250 / 0.4)', label: 'Offices' },
  lift: { fill: 'rgb(234 179 8 / 0.16)', stroke: 'rgb(234 179 8 / 0.5)', label: 'Lifts' },
  stairs: { fill: 'rgb(249 115 22 / 0.16)', stroke: 'rgb(249 115 22 / 0.5)', label: 'Stairs' },
  washroom: { fill: 'rgb(100 116 139 / 0.22)', stroke: 'rgb(100 116 139 / 0.6)', label: 'Washrooms' },
  amenity: { fill: 'rgb(16 185 129 / 0.14)', stroke: 'rgb(16 185 129 / 0.5)', label: 'Amenities' },
  corridor: { fill: 'rgb(15 23 42 / 0.6)', stroke: 'rgb(51 65 85)', label: 'Corridor' },
}

export interface FloorSelection {
  space: FloorSpace
  floor: FloorId
  /** Printed label a dispatcher reads, e.g. "Campus 25 · Floor 2 · C 203". */
  label: string
}

interface FloorPlan3DProps {
  /** Which floor to draw. Floors share a grid; only room numbers differ. */
  floor: FloorId
  selectedId: string | null
  onSelect: (selection: FloorSelection) => void
  /** Rooms to mark as having activity — drawn hot regardless of kind. */
  activeIds?: readonly string[]
  /** Restricts to one wing, or shows all when null. */
  wing: 'A' | 'B' | 'C' | null
  className?: string
}

export function FloorPlan3D({
  floor,
  selectedId,
  onSelect,
  activeIds = [],
  wing,
  className = '',
}: FloorPlan3DProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<FloorSpace | null>(null)

  /* Pointer-driven orbit. Springs keep it weighted; transforms keep it GPU. */
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rotateX = useSpring(useTransform(py, [0, 1], [46, 34]), { stiffness: 120, damping: 20 })
  const rotateZ = useSpring(useTransform(px, [0, 1], [-26, -14]), { stiffness: 120, damping: 20 })

  const visible = useMemo(() => {
    const spaces = spacesForFloor(floor)
    return wing ? spaces.filter((space) => space.wing === wing) : spaces
  }, [floor, wing])
  const activeSet = useMemo(() => new Set(activeIds), [activeIds])

  const onPointerMove = (event: React.PointerEvent) => {
    const box = frameRef.current?.getBoundingClientRect()
    if (!box) return
    px.set((event.clientX - box.left) / box.width)
    py.set((event.clientY - box.top) / box.height)
  }

  return (
    <div className={`relative ${className}`}>
      <MapViewport label={`Floor ${floor}`} className="h-full w-full">
      <div
        ref={frameRef}
        onPointerMove={onPointerMove}
        onPointerLeave={() => {
          px.set(0.5)
          py.set(0.5)
          setHovered(null)
        }}
        className="relative h-full w-full"
        style={{ perspective: 1400 }}
      >
        <div aria-hidden className="aurora-blob aurora-a left-[15%] top-[10%] size-[55%] opacity-60" />

        <motion.svg
          viewBox={`-2 -2 ${PLAN_SIZE + 4} ${PLAN_SIZE + 4}`}
          style={{ rotateX, rotateZ, transformStyle: 'preserve-3d', scale: 1.18 }}
          className="size-full"
          role="img"
          aria-label="Campus 25 second floor plan — select a room to set the incident location"
        >
          {/* Ground slab. */}
          <rect
            x={-4}
            y={-4}
            width={PLAN_SIZE + 8}
            height={PLAN_SIZE + 8}
            rx={3}
            fill="rgb(8 12 20 / 0.85)"
            stroke="rgb(167 139 250 / 0.14)"
            strokeWidth={0.3}
          />

          {/* Circulation spine, flat on the slab. */}
          {FLOOR_CORRIDORS.map((corridor) => (
            <rect
              key={corridor.id}
              x={corridor.x}
              y={corridor.y}
              width={corridor.w}
              height={corridor.h}
              fill="rgb(167 139 250 / 0.1)"
              stroke="rgb(167 139 250 / 0.2)"
              strokeWidth={0.15}
            />
          ))}

          {visible.map((space) => (
            <SpaceBlock
              key={space.id}
              space={space}
              selected={space.id === selectedId}
              active={activeSet.has(space.id)}
              dimmed={hovered !== null && hovered.id !== space.id}
              onHover={setHovered}
              onSelect={() =>
                onSelect({ space, floor, label: `Campus 25 · Floor ${floor} · ${space.id}` })
              }
            />
          ))}
        </motion.svg>

        {/* Hover readout, pinned so it never occludes the plan. */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
          <motion.div
            animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 8 }}
            transition={{ duration: 0.16 }}
            className="glass-chrome rounded-xl px-3.5 py-2"
          >
            <p className="font-mono text-[13px] font-bold text-ops-text">
              {hovered?.id ?? '—'}
              <span className="ml-2 font-sans text-[11px] font-normal text-ops-muted">
                {hovered ? KIND_STYLE[hovered.kind].label.replace(/s$/, '') : ''}
              </span>
            </p>
            {hovered && noteForFloor(hovered.note, floor) && (
              <p className="text-[11px] text-ops-faint">{noteForFloor(hovered.note, floor)}</p>
            )}
          </motion.div>
        </div>
      </div>
      </MapViewport>

      <Legend wing={wing} />
    </div>
  )
}

interface SpaceBlockProps {
  space: FloorSpace
  selected: boolean
  active: boolean
  dimmed: boolean
  onHover: (space: FloorSpace | null) => void
  onSelect: () => void
}

/**
 * One extruded space: a top face plus two side faces, so it reads as a solid
 * under the isometric tilt without needing a mesh.
 */
function SpaceBlock({ space, selected, active, dimmed, onHover, onSelect }: SpaceBlockProps) {
  const style = KIND_STYLE[space.kind]
  const lift = selected ? WALL_DEPTH * 2.4 : active ? WALL_DEPTH * 1.6 : WALL_DEPTH

  const fill = selected
    ? 'rgb(167 139 250 / 0.45)'
    : active
      ? 'rgb(239 68 68 / 0.35)'
      : style.fill
  const stroke = selected
    ? 'rgb(167 139 250)'
    : active
      ? 'rgb(239 68 68 / 0.9)'
      : style.stroke

  return (
    <g
      onPointerEnter={() => onHover(space)}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect()
      }}
      tabIndex={0}
      role="button"
      aria-label={`${space.id}${space.note ? ` — ${space.note}` : ''}`}
      aria-pressed={selected}
      className="cursor-pointer outline-none focus-visible:opacity-100"
      style={{ opacity: dimmed ? 0.45 : 1, transition: 'opacity 160ms ease' }}
    >
      {/* Side faces — the extrusion. Drawn first so the top sits on them. */}
      <polygon
        points={`${space.x},${space.y + space.h} ${space.x + space.w},${space.y + space.h} ${space.x + space.w},${space.y + space.h + lift} ${space.x},${space.y + space.h + lift}`}
        fill="rgb(2 6 16 / 0.75)"
      />
      <polygon
        points={`${space.x + space.w},${space.y} ${space.x + space.w + lift * 0.4},${space.y + lift * 0.4} ${space.x + space.w + lift * 0.4},${space.y + space.h + lift * 0.4} ${space.x + space.w},${space.y + space.h}`}
        fill="rgb(2 6 16 / 0.55)"
      />

      {/* Top face. */}
      <rect
        x={space.x}
        y={space.y}
        width={space.w}
        height={space.h}
        rx={0.6}
        fill={fill}
        stroke={stroke}
        strokeWidth={selected ? 0.55 : 0.28}
      />

      {/* Only larger spaces get an inline label; the rest rely on hover. */}
      {space.w >= 7 && space.h >= 4 && (
        <text
          x={space.x + space.w / 2}
          y={space.y + space.h / 2 + 1.1}
          textAnchor="middle"
          className="pointer-events-none select-none"
          style={{
            fontSize: 2.1,
            fill: selected || active ? 'rgb(226 232 240)' : 'rgb(148 163 184)',
            fontFamily: 'var(--font-jetbrains), monospace',
            fontWeight: 700,
          }}
        >
          {space.id}
        </text>
      )}

      {active && (
        <circle
          cx={space.x + space.w - 1.4}
          cy={space.y + 1.4}
          r={0.9}
          fill="rgb(239 68 68)"
          className="siren-pulse"
        />
      )}
    </g>
  )
}

function Legend({ wing }: { wing: 'A' | 'B' | 'C' | null }) {
  const shown: SpaceKind[] = ['room', 'lecture', 'office', 'lift', 'stairs', 'washroom', 'amenity']

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {shown.map((kind) => (
        <span key={kind} className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-[2px] border"
            style={{ background: KIND_STYLE[kind].fill, borderColor: KIND_STYLE[kind].stroke }}
          />
          <span className="ops-label text-ops-faint">{KIND_STYLE[kind].label}</span>
        </span>
      ))}
      <span className="ops-label ml-auto text-ops-faint">
        {wing ? FLOOR_WINGS.find((entry) => entry.id === wing)?.hint : 'All three wings'}
      </span>
    </div>
  )
}
