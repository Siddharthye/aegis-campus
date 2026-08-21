'use client'

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'
import { useEffect } from 'react'

/**
 * The NEXBOT robot — a 3D head that watches your cursor.
 *
 * Built from layered planes at different `translateZ` depths inside a real
 * perspective container, rather than loaded as a hosted 3D scene. A CDN-backed
 * scene would show an empty box the moment venue wifi drops, and the whole
 * demo is required to survive with networking off — the same reasoning that
 * put a hand-rolled canvas behind the landing hero instead of three.js.
 *
 * Pointer tracking writes to motion values, never to React state, so moving
 * the mouse never triggers a render. Springs do the smoothing, which is what
 * makes the head feel weighted instead of glued to the cursor.
 */

/** How far the head may turn, in degrees. Beyond this it reads as broken. */
const MAX_YAW_DEG = 34
const MAX_PITCH_DEG = 20

/** Eyes lead the head slightly — the cue that sells "it is looking at you". */
const MAX_EYE_SHIFT = 0.16

interface NexbotAvatarProps {
  /** Rendered size in pixels. Every feature scales from this. */
  size?: number
  /** Alert state tints the visor red and quickens the idle bob. */
  alert?: boolean
  className?: string
}

export function NexbotAvatar({ size = 52, alert = false, className = '' }: NexbotAvatarProps) {
  const reduceMotion = useReducedMotion()

  // -1 … 1 on each axis, relative to the viewport centre.
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)

  const springConfig = { stiffness: 140, damping: 18, mass: 0.6 }
  const smoothX = useSpring(pointerX, springConfig)
  const smoothY = useSpring(pointerY, springConfig)

  const rotateY = useTransform(smoothX, [-1, 1], [-MAX_YAW_DEG, MAX_YAW_DEG])
  // Inverted: pointer below centre should tip the face downward.
  const rotateX = useTransform(smoothY, [-1, 1], [MAX_PITCH_DEG, -MAX_PITCH_DEG])
  const eyeX = useTransform(smoothX, [-1, 1], [-MAX_EYE_SHIFT * size, MAX_EYE_SHIFT * size])
  const eyeY = useTransform(smoothY, [-1, 1], [-MAX_EYE_SHIFT * size * 0.5, MAX_EYE_SHIFT * size * 0.5])

  useEffect(() => {
    if (reduceMotion) return

    const track = (event: PointerEvent) => {
      pointerX.set((event.clientX / window.innerWidth) * 2 - 1)
      pointerY.set((event.clientY / window.innerHeight) * 2 - 1)
    }

    window.addEventListener('pointermove', track, { passive: true })
    return () => window.removeEventListener('pointermove', track)
  }, [pointerX, pointerY, reduceMotion])

  const visor = alert ? 'var(--color-sev-p0)' : 'var(--color-ops-accent)'
  const unit = size / 52

  return (
    <div
      className={`pointer-events-none select-none ${className}`}
      style={{ width: size, height: size, perspective: size * 3.4 }}
      aria-hidden="true"
    >
      <motion.div
        className="relative size-full"
        style={{ transformStyle: 'preserve-3d', rotateX, rotateY }}
        animate={reduceMotion ? undefined : { y: [0, -2 * unit, 0] }}
        transition={{ duration: alert ? 1.4 : 3.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Antenna, behind the face so rotation reveals its depth. */}
        <div
          className="absolute left-1/2 rounded-full"
          style={{
            top: -7 * unit,
            width: 2 * unit,
            height: 9 * unit,
            marginLeft: -1 * unit,
            background: 'var(--color-ops-border)',
            transform: `translateZ(${2 * unit}px)`,
          }}
        />
        <div
          className={alert ? 'siren-pulse' : ''}
          style={{
            position: 'absolute',
            left: '50%',
            top: -11 * unit,
            width: 5 * unit,
            height: 5 * unit,
            marginLeft: -2.5 * unit,
            borderRadius: '50%',
            background: visor,
            boxShadow: `0 0 ${7 * unit}px ${visor}`,
            transform: `translateZ(${2 * unit}px)`,
          }}
        />

        {/* Side pods — the parallax that reads as an actual head turning. */}
        {[-1, 1].map((side) => (
          <div
            key={side}
            style={{
              position: 'absolute',
              top: '38%',
              [side === -1 ? 'left' : 'right']: -3 * unit,
              width: 5 * unit,
              height: 13 * unit,
              borderRadius: 3 * unit,
              background: 'var(--color-ops-lift)',
              border: '1px solid var(--color-ops-border)',
              transform: `translateZ(${-2 * unit}px)`,
            }}
          />
        ))}

        {/* Skull. */}
        <div
          className="absolute inset-0"
          style={{
            borderRadius: 15 * unit,
            background: 'linear-gradient(155deg, var(--color-ops-lift), var(--color-ops-panel) 60%)',
            border: '1px solid var(--color-ops-border)',
            transform: 'translateZ(0px)',
          }}
        />

        {/* Face plate, lifted so the visor sits proud of the skull. */}
        <div
          className="absolute"
          style={{
            inset: 3.5 * unit,
            borderRadius: 11 * unit,
            background: 'var(--color-ops-deep)',
            border: `1px solid ${visor}55`,
            transform: `translateZ(${5 * unit}px)`,
          }}
        />

        {/* Visor. */}
        <div
          className="absolute overflow-hidden"
          style={{
            left: 8 * unit,
            right: 8 * unit,
            top: 15 * unit,
            height: 14 * unit,
            borderRadius: 7 * unit,
            background: '#05070d',
            border: `1px solid ${visor}40`,
            boxShadow: `inset 0 0 ${6 * unit}px ${visor}30`,
            transform: `translateZ(${8 * unit}px)`,
          }}
        >
          <motion.div className="absolute inset-0" style={{ x: eyeX, y: eyeY }}>
            {[-1, 1].map((side) => (
              <div
                key={side}
                className={alert ? 'siren-pulse' : ''}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: `calc(50% + ${side * 4.6 * unit}px)`,
                  width: 4.2 * unit,
                  height: 4.2 * unit,
                  marginTop: -2.1 * unit,
                  marginLeft: -2.1 * unit,
                  borderRadius: '50%',
                  background: visor,
                  boxShadow: `0 0 ${5 * unit}px ${visor}`,
                }}
              />
            ))}
          </motion.div>
        </div>

        {/* Mouth grille. */}
        <div
          className="absolute left-1/2 flex gap-[2px]"
          style={{
            top: 34 * unit,
            marginLeft: -6 * unit,
            transform: `translateZ(${7 * unit}px)`,
          }}
        >
          {[0, 1, 2, 3].map((bar) => (
            <span
              key={bar}
              style={{
                display: 'block',
                width: 1.6 * unit,
                height: 4 * unit,
                borderRadius: unit,
                background: `${visor}55`,
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  )
}
