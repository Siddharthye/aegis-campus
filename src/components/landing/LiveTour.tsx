'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'

/**
 * Pinned horizontal product tour: scroll scrubs sideways through three real
 * product surfaces, rendered as stylized frames. Horizontal translate only —
 * the cheapest possible scroll-linked motion.
 */

const SCREENS = [
  {
    label: 'CONTROL ROOM',
    caption: 'One queue, ranked by SLA pressure — with dispatch recommendations reasoned in plain language.',
    body: <ControlFrame />,
  },
  {
    label: 'THREE-TAP REPORT',
    caption: 'Category → location → send. Picking the room on the floor plan pins it to the exact space.',
    body: <ReportFrame />,
  },
  {
    label: 'FUSION BOARD',
    caption: 'Watch twenty raw reports collapse into one incident as confidence climbs.',
    body: <FusionFrame />,
  },
]

export function LiveTour() {
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] })
  const x = useTransform(scrollYProgress, [0.08, 0.92], ['2%', `-${(SCREENS.length - 1) * 100 - 2}%`])

  return (
    <section ref={sectionRef} className="relative" style={{ height: `${SCREENS.length * 110}vh` }}>
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
        <header className="mx-auto w-full max-w-6xl px-6 pb-10">
          <p className="ops-label text-ops-accent">Inside the product</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            The same system, <span className="text-ops-muted">three seats.</span>
          </h2>
        </header>

        <motion.div style={{ x }} className="flex w-full will-change-transform">
          {SCREENS.map((screen) => (
            <div key={screen.label} className="w-full shrink-0 px-6">
              <div className="mx-auto max-w-4xl">
                <div className="card-sheen overflow-hidden rounded-2xl bg-ops-panel/90">
                  {/* Window chrome */}
                  <div className="flex items-center gap-2 border-b border-ops-border px-4 py-3">
                    <span className="size-2.5 rounded-full bg-sev-p0/70" />
                    <span className="size-2.5 rounded-full bg-sev-p2/70" />
                    <span className="size-2.5 rounded-full bg-emerald-400/70" />
                    <span className="ops-label ml-3 text-ops-faint">{screen.label}</span>
                    <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400">
                      <span className="siren-pulse size-1.5 rounded-full bg-current" /> LIVE
                    </span>
                  </div>
                  <div className="p-5">{screen.body}</div>
                </div>
                <p className="mx-auto mt-5 max-w-xl text-center text-sm text-ops-muted">
                  {screen.caption}
                </p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ── Stylized frames — real idioms, no live data dependency ─────────────── */

function Row({ sev, title, meta, wide }: { sev: 'P0' | 'P1' | 'P2'; title: string; meta: string; wide?: boolean }) {
  const color = sev === 'P0' ? 'text-sev-p0 border-sev-p0/40 bg-sev-p0/10' : sev === 'P1' ? 'text-sev-p1 border-sev-p1/40 bg-sev-p1/10' : 'text-sev-p2 border-sev-p2/40 bg-sev-p2/10'
  return (
    <div className={`flex items-center gap-3 rounded-lg border border-ops-border bg-ops-bg/70 px-3 py-2.5 ${wide ? '' : ''}`}>
      <span className={`ops-label rounded border px-1.5 py-0.5 ${color}`}>{sev}</span>
      <span className="truncate text-[13px] font-medium">{title}</span>
      <span className="ml-auto shrink-0 font-mono text-[10px] text-ops-faint">{meta}</span>
    </div>
  )
}

function ControlFrame() {
  return (
    <div className="grid gap-2.5">
      <Row sev="P0" title="Fire alarm — Block C · Floor 3" meta="SLA 03:12 · 20 reports" />
      <Row sev="P1" title="Student collapsed — Central Library" meta="SLA 06:44 · dispatched" />
      <Row sev="P2" title="Water leak — Hostel 8 stairwell" meta="on-scene" />
      <div className="mt-1 rounded-lg border border-ops-accent/30 bg-ops-accent/5 px-3 py-2.5 text-[12px] text-ops-muted">
        <span className="ops-label mr-2 text-ops-accent">Dispatch</span>
        Nearest available fire unit — K. Das, 210m, ETA 3 min
      </div>
    </div>
  )
}

function ReportFrame() {
  return (
    <div className="mx-auto grid max-w-sm gap-2.5">
      <div className="grid grid-cols-3 gap-2">
        {['FIRE', 'MEDICAL', 'HARASS'].map((category, index) => (
          <div
            key={category}
            className={`ops-label rounded-lg border px-2 py-3 text-center ${
              index === 0 ? 'border-sev-p0/50 bg-sev-p0/10 text-sev-p0' : 'border-ops-border text-ops-faint'
            }`}
          >
            {category}
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-emerald-400/40 bg-emerald-400/5 px-3 py-2.5 text-[12px]">
        <span className="ops-label mr-2 text-emerald-400">Floor plan</span>
        Block C · Floor 3 · Room 302 — <span className="font-mono">85%</span>
      </div>
      <div className="rounded-lg bg-sev-p0 py-2.5 text-center text-[13px] font-bold text-white">
        SEND REPORT
      </div>
      <p className="text-center text-[10px] text-ops-faint">Triple-tap the shield for silent mode</p>
    </div>
  )
}

function FusionFrame() {
  return (
    <div className="grid gap-2.5">
      <div className="rounded-lg border border-ops-border bg-ops-bg/70 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold">Smoke — Block C chemistry wing</span>
          <span className="ops-label text-sev-p0">P0 · auto-escalated</span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded bg-ops-border">
          <div className="h-full w-[96%] rounded bg-gradient-to-r from-sev-p2 via-sev-p1 to-sev-p0" />
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ops-faint">
          <span>20 reports · 17 reporters</span>
          <span className="text-ops-text">96% corroborated</span>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-ops-border px-3 py-2 text-[11px] text-ops-faint">
        <span className="ops-label rounded border border-sev-p2/40 bg-sev-p2/10 px-1.5 py-0.5 text-sev-p2">QUARANTINE</span>
        “lol the campus is on fire fr” — lone reporter, no corroboration
      </div>
    </div>
  )
}
