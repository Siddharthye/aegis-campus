'use client'

import { motion, useMotionValue, useSpring } from 'framer-motion'
import Link from 'next/link'
import { useRef } from 'react'

interface MagneticButtonProps {
  href: string
  children: React.ReactNode
  variant?: 'primary' | 'ghost'
}

/**
 * Apple-style magnetic button: the label leans toward the pointer inside a
 * small radius, then springs home on leave. Transform-only, spring-driven —
 * never re-renders during interaction.
 */
export function MagneticButton({ href, children, variant = 'primary' }: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 260, damping: 18 })
  const springY = useSpring(y, { stiffness: 260, damping: 18 })

  const onPointerMove = (event: React.PointerEvent) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    x.set((event.clientX - box.left - box.width / 2) * 0.28)
    y.set((event.clientY - box.top - box.height / 2) * 0.28)
  }

  const reset = () => {
    x.set(0)
    y.set(0)
  }

  const styles =
    variant === 'primary'
      ? 'bg-ops-accent text-ops-deep hover:bg-sky-300'
      : 'border border-ops-border bg-ops-panel/60 text-ops-text hover:border-ops-accent/50'

  return (
    <motion.div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      style={{ x: springX, y: springY }}
      className="inline-block"
    >
      <Link
        href={href}
        className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold tracking-tight transition-colors ${styles}`}
      >
        {children}
      </Link>
    </motion.div>
  )
}
