'use client'

import { animate, useInView, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'

interface AnimatedNumberProps {
  value: number
  /** Appended after the digits, e.g. "m" or "/6". */
  suffix?: string
  className?: string
}

/**
 * Counts up to a value when it scrolls into view.
 *
 * Writes straight to the DOM node from the animation frame rather than
 * through state, so a two-second count-up is zero React renders. Under
 * reduced motion the final value simply appears.
 */
export function AnimatedNumber({ value, suffix = '', className }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const node = ref.current
    if (!node || !inView) return

    if (reduceMotion) {
      node.textContent = `${value}${suffix}`
      return
    }

    const controls = animate(0, value, {
      duration: 1.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        node.textContent = `${Math.round(latest)}${suffix}`
      },
    })
    return () => controls.stop()
  }, [inView, value, suffix, reduceMotion])

  // Server-renders the final value so the number is correct without JS and
  // for crawlers; the effect rewinds and plays it once visible.
  return (
    <span ref={ref} className={className}>
      {value}
      {suffix}
    </span>
  )
}
