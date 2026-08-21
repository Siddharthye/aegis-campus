'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'

/**
 * How every page arrives: rising out of a blur, settling to scale.
 *
 * While this plays, the wrapper's transform re-anchors `position: fixed`
 * descendants — acceptable because navigation lands at scroll zero, where
 * viewport and page coordinates agree, and the landing backdrop re-measures
 * itself through a ResizeObserver once the transform clears. The blur lives
 * on an overlay rather than the content, so the compositor never has to
 * re-filter the whole tree per frame.
 */
const EASE = [0.22, 1, 0.36, 1] as const

export default function Template({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion()
  // The veil unmounts once lifted — an invisible backdrop-filter still bills
  // the compositor every frame if it stays.
  const [veilDone, setVeilDone] = useState(false)

  if (reduceMotion) return <>{children}</>

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.984, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE }}
      style={{ transformOrigin: '50% 30%' }}
    >
      {/* A veil that lifts: cheap stand-in for blurring the page itself. */}
      {!veilDone && (
      <motion.div
        aria-hidden
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        onAnimationComplete={() => setVeilDone(true)}
        className="pointer-events-none fixed inset-0 z-[90]"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 30%, rgb(167 139 250 / 0.06), transparent 70%), rgb(8 7 12 / 0.55)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      />
      )}
      {children}
    </motion.div>
  )
}
