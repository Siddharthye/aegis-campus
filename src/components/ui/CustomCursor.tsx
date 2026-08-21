'use client'

import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useState } from 'react'

/**
 * The landing page's cursor: a crisp dot that tracks the pointer exactly,
 * inside a soft ring that arrives a beat later on a spring. The ring swells
 * over anything clickable and tightens while the button is down, so the
 * cursor itself narrates what the hand is doing.
 *
 * Landing only, and only for fine pointers — the ops screens keep the
 * browser's own cursors, because a dispatcher's crosshair and grab cursors
 * are information, not decoration. Touch devices and reduced-motion users
 * never see this at all.
 */
export function CustomCursor() {
  const [active, setActive] = useState(false)
  const [overLink, setOverLink] = useState(false)
  const [pressed, setPressed] = useState(false)

  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const ringX = useSpring(x, { stiffness: 320, damping: 28, mass: 0.6 })
  const ringY = useSpring(y, { stiffness: 320, damping: 28, mass: 0.6 })

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!fine || still) return

    setActive(true)
    document.documentElement.classList.add('native-cursor-off')

    const onMove = (event: PointerEvent) => {
      x.set(event.clientX)
      y.set(event.clientY)
      setOverLink(
        (event.target as Element | null)?.closest?.('a, button, [role="button"]') != null,
      )
    }
    const onDown = () => setPressed(true)
    const onUp = () => setPressed(false)

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)

    return () => {
      document.documentElement.classList.remove('native-cursor-off')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
    }
  }, [x, y])

  if (!active) return null

  const ringScale = pressed ? 0.75 : overLink ? 1.8 : 1

  return (
    <>
      {/* The dot: pinned to the true pointer position, zero lag. */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[100] size-1.5 rounded-full bg-ops-accent"
        style={{ x, y, translateX: '-50%', translateY: '-50%' }}
      />
      {/* The ring: springs into place, swells over anything clickable. */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[100] size-8 rounded-full border border-ops-accent/50"
        style={{ x: ringX, y: ringY, translateX: '-50%', translateY: '-50%' }}
        animate={{ scale: ringScale, opacity: overLink ? 0.9 : 0.55 }}
        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      />
    </>
  )
}
