'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Crosshair, Maximize2, Minus, Move, Plus, X } from 'lucide-react'

/**
 * Zoom, pan and fullscreen for any SVG map.
 *
 * Wraps its child in a transformed layer rather than re-rendering it, so
 * panning a floor with ninety rooms costs one composited transform. Both the
 * floor plan and the campus map use this, which is why they behave
 * identically — the same gestures, the same controls, the same reset.
 *
 * Wheel zoom is anchored under the cursor: zooming toward a specific room is
 * the whole point, and a centre-anchored zoom makes you chase it.
 */

const MIN_SCALE = 0.6
const MAX_SCALE = 6
/** Button step. Wheel uses a far gentler per-notch factor — see onWheel. */
const ZOOM_STEP = 1.25

/** Per-wheel-notch zoom. Trackpads emit many small deltas; this keeps them calm. */
const WHEEL_SENSITIVITY = 0.0015

/**
 * Keeps the map inside its frame.
 *
 * The content is the frame scaled about its top-left corner, so a pan is only
 * legal while the scaled content still covers the frame. Without this a drag
 * throws the campus clean out of view and leaves an empty box, which reads as
 * the map having broken rather than as the map having moved.
 */
function clampOffset(
  offset: { x: number; y: number },
  scale: number,
  frame: { width: number; height: number },
) {
  const spare = (extent: number) => extent * (1 - scale)
  const bound = (value: number, limit: number) =>
    Math.min(Math.max(value, Math.min(0, limit)), Math.max(0, limit))

  return {
    x: bound(offset.x, spare(frame.width)),
    y: bound(offset.y, spare(frame.height)),
  }
}

interface MapViewportProps {
  children: React.ReactNode
  /** Shown top-left inside the frame. */
  label?: string
  /** Extra controls rendered beside the zoom buttons. */
  actions?: React.ReactNode
  className?: string
}

export function MapViewport({ children, label, actions, className = '' }: MapViewportProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [panning, setPanning] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const reset = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  /** Zooms about a point in frame coordinates, keeping it visually fixed. */
  const zoomAbout = useCallback((factor: number, originX?: number, originY?: number) => {
    const frame = frameRef.current
    if (!frame) return
    const box = frame.getBoundingClientRect()
    const cx = originX ?? box.width / 2
    const cy = originY ?? box.height / 2

    setScale((current) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current * factor))
      const ratio = next / current
      setOffset((previous) =>
        clampOffset(
          { x: cx - ratio * (cx - previous.x), y: cy - ratio * (cy - previous.y) },
          next,
          box,
        ),
      )
      return next
    })
  }, [])

  // Non-passive so the page does not scroll while zooming the map.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const box = frame.getBoundingClientRect()
      // Scale continuously with the delta rather than stepping per event: a
      // trackpad fires dozens of small deltas per gesture, and a fixed step
      // per event made the map leap across several zoom levels at once.
      const factor = Math.exp(-event.deltaY * WHEEL_SENSITIVITY)
      zoomAbout(factor, event.clientX - box.left, event.clientY - box.top)
    }

    frame.addEventListener('wheel', onWheel, { passive: false })
    return () => frame.removeEventListener('wheel', onWheel)
  }, [zoomAbout])

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  const onPointerDown = (event: React.PointerEvent) => {
    // Left button only, and never steal a click meant for a room.
    if (event.button !== 0) return
    dragStart.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const start = dragStart.current
    if (!start) return

    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    // A few pixels of slop so a click is still a click, not a one-pixel pan.
    if (!panning && Math.hypot(dx, dy) < 4) return

    const box = frameRef.current?.getBoundingClientRect()
    if (!box) return

    setPanning(true)
    setOffset(clampOffset({ x: start.ox + dx, y: start.oy + dy }, scale, box))
  }

  const endPan = () => {
    dragStart.current = null
    setPanning(false)
  }

  const frame = (
    <div
      ref={frameRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerLeave={endPan}
      className={`relative overflow-hidden rounded-xl border border-ops-border/70 bg-ops-bg ${
        panning ? 'cursor-grabbing' : 'cursor-grab'
      } ${fullscreen ? 'h-full w-full' : className}`}
    >
      <div
        className="size-full origin-top-left"
        style={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
          transition: panning ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {children}
      </div>

      {label && (
        <span className="ops-label glass-chrome pointer-events-none absolute left-3 top-3 rounded-md px-2 py-1 text-ops-muted">
          {label}
        </span>
      )}

      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        <div className="glass-chrome flex flex-col overflow-hidden rounded-lg">
          <ControlButton label="Zoom in" onClick={() => zoomAbout(ZOOM_STEP)}>
            <Plus className="size-3.5" />
          </ControlButton>
          <ControlButton label="Zoom out" onClick={() => zoomAbout(1 / ZOOM_STEP)}>
            <Minus className="size-3.5" />
          </ControlButton>
          <ControlButton label="Reset view" onClick={reset}>
            <Crosshair className="size-3.5" />
          </ControlButton>
          <ControlButton
            label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            onClick={() => setFullscreen((current) => !current)}
          >
            {fullscreen ? <X className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </ControlButton>
        </div>
        {actions}
      </div>

      <span className="ops-label glass-chrome pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md px-2 py-1 text-ops-faint">
        <Move className="size-3" />
        {Math.round(scale * 100)}%
      </span>
    </div>
  )

  if (!fullscreen) return frame

  return (
    <div className="fixed inset-0 z-[80] bg-ops-deep/95 p-4 backdrop-blur-sm">
      <div className="size-full">{frame}</div>
    </div>
  )
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      // Stops the pan handler treating a control press as a drag.
      onPointerDown={(event) => event.stopPropagation()}
      className="grid size-11 place-items-center text-ops-muted transition-colors hover:bg-ops-lift hover:text-ops-text sm:size-8"
    >
      {children}
    </button>
  )
}
