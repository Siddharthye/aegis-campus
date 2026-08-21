'use client'

import Lenis from 'lenis'
import { useEffect } from 'react'

/**
 * Lenis smooth scrolling for the landing page. Interpolated scroll is what
 * makes the parallax scenes feel liquid instead of stepped.
 *
 * Honours `prefers-reduced-motion` by simply not initialising.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 })
    let frame = 0

    const raf = (time: number) => {
      lenis.raf(time)
      frame = requestAnimationFrame(raf)
    }
    frame = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(frame)
      lenis.destroy()
    }
  }, [])

  return <>{children}</>
}
