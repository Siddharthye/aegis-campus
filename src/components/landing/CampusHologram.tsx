'use client'

import { useEffect, useRef } from 'react'
import { campusGeoJSON, CAMPUS_CENTRE } from '@/data/campus'

/**
 * The hero visual: the real campus dataset rendered as a slowly rotating
 * isometric hologram, with incident pulses and a radar sweep.
 *
 * Hand-rolled 2D canvas rather than WebGL/three.js on purpose:
 * fourteen extruded buildings are trivial to paint at 60fps, there is no
 * three-hundred-kilobyte dependency to ship, and nothing here can fail on a
 * weak GPU. The same `campus.ts` dataset also drives the ATLAS 3D map, so the
 * marketing hero and the product literally render the same data.
 */

const M_PER_DEG_LAT = 111_320
const ISO_ANGLE = Math.PI / 6 // 30° — the classic isometric projection.
const FLATTEN = 0.72 // Vertical squash applied to the ground plane.
const ROTATION_SPEED = 0.00006 // rad/ms — one full turn ≈ 105 s. Calm, not dizzy.
const HEIGHT_SCALE = 1.35

/** Demo incident pulse sites (building ids from the campus dataset). */
const PULSE_SITES = [
  { buildingId: 'block-c', color: '239, 68, 68' }, // P0 red
  { buildingId: 'hostel-9', color: '249, 115, 22' }, // P1 orange
  { buildingId: 'library', color: '167, 139, 250' }, // P3 accent
]

const KIND_ROOF: Record<string, string> = {
  academic: '#1c2b45',
  hostel: '#22304f',
  public: '#1a3049',
  medical: '#33244a',
  utility: '#39301f',
  security: '#3a2226',
}

interface Building {
  /** Footprint corners in local metres, centred on campus centre. */
  corners: { x: number; y: number }[]
  centre: { x: number; y: number }
  heightM: number
  roof: string
}

/** Converts the GeoJSON once into local-metre geometry the paint loop can use. */
function prepareBuildings(): { buildings: Building[]; pulses: { x: number; y: number; color: string }[] } {
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((CAMPUS_CENTRE.lat * Math.PI) / 180)
  const toLocal = ([lng, lat]: readonly [number, number]) => ({
    x: (lng - CAMPUS_CENTRE.lng) * mPerDegLng,
    y: (lat - CAMPUS_CENTRE.lat) * M_PER_DEG_LAT,
  })

  const buildings = campusGeoJSON.features.map((feature) => {
    const ring = feature.geometry.coordinates[0].slice(0, -1)
    const corners = ring.map((position) => toLocal(position as unknown as readonly [number, number]))
    const centre = {
      x: corners.reduce((sum, corner) => sum + corner.x, 0) / corners.length,
      y: corners.reduce((sum, corner) => sum + corner.y, 0) / corners.length,
    }
    return {
      corners,
      centre,
      heightM: feature.properties.heightM * HEIGHT_SCALE,
      roof: KIND_ROOF[feature.properties.kind] ?? '#1c2b45',
    }
  })

  const pulses = PULSE_SITES.flatMap(({ buildingId, color }) => {
    const index = campusGeoJSON.features.findIndex((feature) => feature.properties.id === buildingId)
    return index === -1 ? [] : [{ ...buildings[index].centre, color }]
  })

  return { buildings, pulses }
}

export function CampusHologram({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const { buildings, pulses } = prepareBuildings()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let frame = 0
    let running = true
    let width = 0
    let height = 0

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const box = canvas.getBoundingClientRect()
      width = box.width
      height = box.height
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    /* Pause the loop entirely when the hero is scrolled away. */
    const visibility = new IntersectionObserver(([observed]) => {
      running = observed.isIntersecting
      if (running) frame = requestAnimationFrame(paint)
      else cancelAnimationFrame(frame)
    })
    visibility.observe(canvas)

    const onPointer = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect()
      pointerRef.current = {
        x: ((event.clientX - box.left) / box.width - 0.5) * 2,
        y: ((event.clientY - box.top) / box.height - 0.5) * 2,
      }
    }
    canvas.addEventListener('pointermove', onPointer, { passive: true })

    const paint = (time: number) => {
      if (!running) return

      const rotation = reducedMotion
        ? -0.5
        : time * ROTATION_SPEED + pointerRef.current.x * 0.12
      const tilt = FLATTEN + (reducedMotion ? 0 : pointerRef.current.y * 0.05)
      const cos = Math.cos(rotation)
      const sin = Math.sin(rotation)
      const scale = Math.min(width, height) / 720

      /** Local metres → screen point, via rotate-then-isometric. */
      const project = (x: number, y: number, z: number) => {
        const rx = x * cos - y * sin
        const ry = x * sin + y * cos
        return {
          x: width / 2 + (rx - ry) * Math.cos(ISO_ANGLE) * scale,
          y: height * 0.52 + (rx + ry) * Math.sin(ISO_ANGLE) * tilt * scale - z * scale,
          depth: rx + ry,
        }
      }

      context.clearRect(0, 0, width, height)

      /* Ground grid — a subtle perspective floor. */
      context.strokeStyle = 'rgba(167, 139, 250, 0.08)'
      context.lineWidth = 1
      for (let g = -420; g <= 420; g += 60) {
        const a = project(g, -420, 0)
        const b = project(g, 420, 0)
        const c = project(-420, g, 0)
        const d = project(420, g, 0)
        context.beginPath()
        context.moveTo(a.x, a.y)
        context.lineTo(b.x, b.y)
        context.moveTo(c.x, c.y)
        context.lineTo(d.x, d.y)
        context.stroke()
      }

      /* Radar sweep — a rotating translucent wedge under the buildings. */
      if (!reducedMotion) {
        const sweep = time * 0.0009
        const centre = project(0, 0, 0)
        const radius = 340 * scale
        const gradient = context.createConicGradient(sweep, centre.x, centre.y)
        gradient.addColorStop(0, 'rgba(167, 139, 250, 0.11)')
        gradient.addColorStop(0.12, 'rgba(167, 139, 250, 0)')
        gradient.addColorStop(1, 'rgba(167, 139, 250, 0)')
        context.fillStyle = gradient
        context.beginPath()
        context.ellipse(centre.x, centre.y, radius, radius * Math.sin(ISO_ANGLE) * 2 * tilt, 0, 0, Math.PI * 2)
        context.fill()
      }

      /* Buildings, painter-sorted so nearer prisms cover farther ones. */
      const sorted = [...buildings].sort(
        (a, b) => project(a.centre.x, a.centre.y, 0).depth - project(b.centre.x, b.centre.y, 0).depth,
      )

      for (const building of sorted) {
        const base = building.corners.map((corner) => project(corner.x, corner.y, 0))
        const top = building.corners.map((corner) => project(corner.x, corner.y, building.heightM))

        /* Walls: only edges facing the camera, darker than the roof. */
        for (let i = 0; i < base.length; i++) {
          const j = (i + 1) % base.length
          const facing = (base[j].x - base[i].x) * 1 >= 0 // left-to-right edges face us
          if (!facing) continue
          context.beginPath()
          context.moveTo(base[i].x, base[i].y)
          context.lineTo(base[j].x, base[j].y)
          context.lineTo(top[j].x, top[j].y)
          context.lineTo(top[i].x, top[i].y)
          context.closePath()
          context.fillStyle = '#0d1526'
          context.fill()
          context.strokeStyle = 'rgba(167, 139, 250, 0.16)'
          context.stroke()
        }

        /* Roof. */
        context.beginPath()
        context.moveTo(top[0].x, top[0].y)
        for (let i = 1; i < top.length; i++) context.lineTo(top[i].x, top[i].y)
        context.closePath()
        context.fillStyle = building.roof
        context.fill()
        context.strokeStyle = 'rgba(167, 139, 250, 0.42)'
        context.stroke()
      }

      /* Incident pulses — expanding rings on the ground at each site. */
      context.globalCompositeOperation = 'lighter'
      for (const [index, pulse] of pulses.entries()) {
        const phase = ((time * 0.0011 + index * 0.37) % 1 + 1) % 1
        const point = project(pulse.x, pulse.y, 0)
        const radius = (10 + phase * 46) * scale
        const alpha = 0.5 * (1 - phase)
        context.beginPath()
        context.ellipse(point.x, point.y, radius, radius * Math.sin(ISO_ANGLE) * 2 * tilt, 0, 0, Math.PI * 2)
        context.strokeStyle = `rgba(${pulse.color}, ${alpha})`
        context.lineWidth = 2
        context.stroke()

        context.beginPath()
        context.arc(point.x, point.y, 3, 0, Math.PI * 2)
        context.fillStyle = `rgba(${pulse.color}, 0.9)`
        context.fill()
      }
      context.globalCompositeOperation = 'source-over'

      frame = requestAnimationFrame(paint)
    }

    frame = requestAnimationFrame(paint)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      visibility.disconnect()
      canvas.removeEventListener('pointermove', onPointer)
    }
  }, [])

  return <canvas ref={canvasRef} className={className} aria-hidden />
}
