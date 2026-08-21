'use client'

import { motion, useMotionValue, useTransform } from 'framer-motion'
import { useRef } from 'react'

/**
 * The shared surface vocabulary.
 *
 * Every screen has its own layout, but they are cut from the same material:
 * one hairline border, one soft ground, an accent-tinted spotlight that
 * follows the cursor. Keeping the *material* consistent is what lets the
 * *layouts* differ without the product feeling like several products.
 */

interface PanelProps {
  /** Uppercase micro-label above the content. */
  label?: string
  /** Right-aligned counterpart to the label — counts, status, a control. */
  aside?: React.ReactNode
  /** Adds the pointer-tracking spotlight. Off for dense list rows. */
  spotlight?: boolean
  tone?: 'default' | 'accent' | 'danger'
  className?: string
  children: React.ReactNode
}

const TONE_RING: Record<NonNullable<PanelProps['tone']>, string> = {
  default: 'border-ops-border/80',
  accent: 'border-ops-accent/35',
  danger: 'border-sev-p0/40',
}

export function Panel({
  label,
  aside,
  spotlight = false,
  tone = 'default',
  className = '',
  children,
}: PanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const mx = useMotionValue(-999)
  const my = useMotionValue(-999)

  const background = useTransform(
    [mx, my],
    ([x, y]) =>
      `radial-gradient(340px circle at ${x}px ${y}px, rgb(167 139 250 / 0.07), transparent 68%)`,
  )

  const track = (event: React.PointerEvent) => {
    if (!spotlight) return
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    mx.set(event.clientX - box.left)
    my.set(event.clientY - box.top)
  }

  return (
    <section
      ref={ref}
      onPointerMove={track}
      onPointerLeave={() => {
        mx.set(-999)
        my.set(-999)
      }}
      className={`relative overflow-hidden rounded-2xl border bg-ops-panel/70 ${TONE_RING[tone]} ${className}`}
    >
      {spotlight && (
        <motion.div aria-hidden style={{ background }} className="pointer-events-none absolute inset-0" />
      )}

      {(label || aside) && (
        <header className="relative flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ops-border/70 px-4 py-2.5">
          {label && <p className="ops-label text-ops-muted">{label}</p>}
          {aside && (
            <div className="scrollbar-none ml-auto flex max-w-full items-center gap-2 overflow-x-auto">
              {aside}
            </div>
          )}
        </header>
      )}

      <div className="relative">{children}</div>
    </section>
  )
}

/**
 * A single figure with its label. The density workhorse — a row of these
 * fills space with information instead of padding.
 */
export function Stat({
  value,
  label,
  tone = 'default',
  hint,
}: {
  value: React.ReactNode
  label: string
  /** Same vocabulary as Chip, so a screen can tone both consistently. */
  tone?: 'default' | 'accent' | 'danger' | 'good' | 'warn'
  hint?: string
}) {
  const colour = {
    default: 'text-ops-text',
    accent: 'text-ops-accent',
    danger: 'text-sev-p0',
    good: 'text-emerald-400',
    warn: 'text-sev-p1',
  }[tone]

  return (
    <div className="min-w-0" title={hint}>
      <p className={`font-mono text-xl font-bold leading-none ${colour}`}>{value}</p>
      <p className="ops-label mt-1.5 truncate text-ops-faint">{label}</p>
    </div>
  )
}

/** A compact filled bar — proportions at a glance, no chart library. */
export function MiniBar({ value, max, tone = 'accent' }: { value: number; max: number; tone?: 'accent' | 'danger' | 'good' }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100))
  const fill = tone === 'danger' ? 'bg-sev-p0' : tone === 'good' ? 'bg-emerald-400' : 'bg-ops-accent'

  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-ops-bg">
      <div className={`h-full rounded-full ${fill} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** A labelled pill. Used for status, severity, filters, and counts. */
export function Chip({
  children,
  tone = 'default',
  active = false,
  onClick,
  title,
}: {
  children: React.ReactNode
  tone?: 'default' | 'accent' | 'danger' | 'good' | 'warn'
  active?: boolean
  onClick?: () => void
  title?: string
}) {
  const tones = {
    default: 'border-ops-border text-ops-muted',
    accent: 'border-ops-accent/40 text-ops-accent',
    danger: 'border-sev-p0/45 text-sev-p0',
    good: 'border-emerald-400/40 text-emerald-400',
    warn: 'border-sev-p1/45 text-sev-p1',
  } as const

  const className = `ops-label inline-flex min-h-11 items-center justify-center rounded-full border px-3 py-1 transition-colors sm:min-h-0 sm:px-2.5 ${tones[tone]} ${
    active ? 'bg-ops-accent/15 text-ops-accent' : ''
  } ${onClick ? 'hover:bg-ops-lift cursor-pointer' : ''}`

  if (!onClick) return <span className={className} title={title}>{children}</span>

  return (
    <button type="button" onClick={onClick} className={className} aria-pressed={active} title={title}>
      {children}
    </button>
  )
}
