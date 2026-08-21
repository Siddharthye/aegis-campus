'use client'

import { motion, useReducedMotion } from 'framer-motion'

/**
 * One quiet fade for every route change.
 *
 * Opacity only, deliberately: a transform here would make this wrapper the
 * containing block for every `position: fixed` descendant — the dock, the
 * fullscreen map, the landing backdrop — pinning them to the page instead of
 * the viewport while the entrance plays.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
