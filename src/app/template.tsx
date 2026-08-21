'use client'

import { motion, useReducedMotion } from 'framer-motion'

/**
 * How every page arrives: a short, weighty settle — opacity, a whisper of
 * scale, a few pixels of rise. No veil and no blur: a full-screen overlay
 * read as a dark flash between pages, which is the opposite of seamless.
 *
 * The ease is Apple's sheet curve — fast out of the gate, long soft landing.
 * Fixed descendants are safe: navigation lands at scroll zero where page and
 * viewport agree, and the landing backdrop re-measures itself afterwards.
 */
const APPLE_EASE = [0.32, 0.72, 0, 1] as const

export default function Template({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion()

  // The wrapper renders either way — returning a bare fragment under reduced
  // motion changes the tree between server and client and fails hydration.
  // Reduced motion gets the same structure with the duration zeroed.
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.992, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.45, ease: APPLE_EASE }}
      style={{ transformOrigin: '50% 20%' }}
    >
      {children}
    </motion.div>
  )
}
