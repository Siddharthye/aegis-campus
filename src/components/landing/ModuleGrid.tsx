'use client'

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useRef } from 'react'

/**
 * The module marketplace: six subsystems as 3D-tilting cards. Three are listed
 * for sale on the HACQUIRE floor; three are kept in-house — and saying so out
 * loud is part of the pitch.
 */

const MODULES = [
  {
    name: 'SIREN',
    role: 'Geofenced alerts & broadcast',
    detail: 'Radius-targeted alerts with acknowledgement tracking and an escalation ladder. REST + SSE + widget + React.',
    forSale: true,
    price: '₹5.00 Cr',
  },
  {
    name: 'ATLAS',
    role: 'Live 3D map + triage engine',
    detail: 'Vector 3D campus map with clustering and heatmaps — plus an explainable severity triage engine.',
    forSale: true,
    price: '₹5.00 Cr',
  },
  {
    name: 'FUSION',
    role: 'Duplicate report fusion',
    detail: 'Fifty reports of one fire become one incident with climbing corroboration confidence. Pranks quarantined.',
    forSale: true,
    price: '₹5.00 Cr',
  },
  {
    name: 'SENTINEL',
    role: 'Silent panic & safe walk',
    detail: 'Triple-tap arms a decoy screen while location streams silently. PIN to cancel. Missed check-ins auto-alarm.',
    forSale: false,
  },
  {
    name: 'BEACON',
    role: 'Room-level indoor location',
    detail: 'Printed QR anchors resolve building, floor, and room at 99% confidence — where GPS gives a ±30m blur.',
    forSale: false,
  },
  {
    name: 'PULSE',
    role: 'Risk forecast & patrol planner',
    detail: 'Hotspot ranking, SLA scorecards, and patrol recommendations generated from real incident history.',
    forSale: false,
  },
]

export function ModuleGrid() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 py-28 sm:py-36">
      <p className="ops-label text-ops-accent">Built. Bought. Sold.</p>
      <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
        Six subsystems. Three on the market.
        <span className="text-ops-muted"> Three we’d never sell.</span>
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ops-muted sm:text-base">
        Every module for sale runs inside AEGIS itself — buyers integrate the exact code we
        depend on, over REST, an embeddable widget, or a React component. No database, no
        API keys, one command to run.
      </p>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((module, index) => (
          <TiltCard key={module.name} module={module} index={index} />
        ))}
      </div>
    </section>
  )
}

function TiltCard({ module, index }: { module: (typeof MODULES)[number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null)

  /* Pointer-tracked 3D tilt: rotate around both axes toward the cursor, with a
     glare highlight following. Springs keep it fluid; transforms keep it GPU. */
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rotateX = useSpring(useTransform(py, [0, 1], [7, -7]), { stiffness: 220, damping: 20 })
  const rotateY = useSpring(useTransform(px, [0, 1], [-9, 9]), { stiffness: 220, damping: 20 })
  const glareX = useTransform(px, [0, 1], ['20%', '80%'])
  const glareY = useTransform(py, [0, 1], ['15%', '85%'])

  const onPointerMove = (event: React.PointerEvent) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    px.set((event.clientX - box.left) / box.width)
    py.set((event.clientY - box.top) / box.height)
  }

  const reset = () => {
    px.set(0.5)
    py.set(0.5)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay: (index % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
      style={{ perspective: 900 }}
    >
      <motion.div
        ref={ref}
        onPointerMove={onPointerMove}
        onPointerLeave={reset}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="card-sheen group relative h-full rounded-2xl bg-ops-panel/80 p-6"
      >
        {/* Glare that follows the pointer. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: useTransform(
              [glareX, glareY],
              ([gx, gy]) => `radial-gradient(280px circle at ${gx} ${gy}, rgb(56 189 248 / 0.10), transparent 65%)`,
            ),
          }}
        />

        <div style={{ transform: 'translateZ(24px)' }}>
          <header className="flex items-start justify-between gap-3">
            <h3 className="font-mono text-lg font-bold tracking-wide text-ops-text">{module.name}</h3>
            {module.forSale ? (
              <span className="ops-label rounded-full border border-ops-accent/40 bg-ops-accent/10 px-2.5 py-1 text-ops-accent">
                For sale · {module.price}
              </span>
            ) : (
              <span className="ops-label rounded-full border border-ops-border px-2.5 py-1 text-ops-faint">
                Not for sale
              </span>
            )}
          </header>

          <p className="mt-2 text-sm font-medium text-ops-muted">{module.role}</p>
          <p className="mt-3 text-[13px] leading-relaxed text-ops-muted/80">{module.detail}</p>
        </div>
      </motion.div>
    </motion.div>
  )
}
