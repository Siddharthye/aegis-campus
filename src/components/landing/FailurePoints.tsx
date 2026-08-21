'use client'

import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { useRef } from 'react'

/**
 * Apple-style pinned storytelling: the viewport locks while scroll scrubs
 * through the four points where campus emergencies actually fail — the
 * narrative spine of the whole product (see DESIGN.md).
 */

const FAILURES = [
  {
    index: '01',
    problem: 'People can’t report fast enough.',
    answer: 'Three taps to file. Triple-tap to go silent.',
    detail:
      'A full report is category → location → send. In danger, SENTINEL turns the screen into a decoy calculator while location streams silently to the control room — and only a PIN can stop it.',
    module: 'SENTINEL',
    color: 'text-sev-p0',
  },
  {
    index: '02',
    problem: 'The third person to be followed there learns nothing from the first two.',
    answer: 'Reports go in separately. The pattern comes back out.',
    detail:
      'Every report reaches the control room alone, so the place that keeps producing them stays invisible to the next person walking through it. SIGHTLINE clusters reports by place and hour, requires them to come from different people, and ranks tonight’s routes by what has actually been reported — the one thing a live-location share can never tell you.',
    module: 'SIGHTLINE',
    color: 'text-sev-p1',
  },
  {
    index: '03',
    problem: 'The control room drowns in duplicates.',
    answer: 'Fifty reports. One incident. 96% sure.',
    detail:
      'FUSION clusters reports by space, time, and text; corroboration confidence climbs as reports pour in, velocity auto-escalates severity, and lone prank reports are quarantined before anyone dispatches.',
    module: 'FUSION',
    color: 'text-sev-p2',
  },
  {
    index: '04',
    problem: 'Nobody learns anything afterward.',
    answer: 'Analytics that output actions, not charts.',
    detail:
      '“Hostel 9 corridor, Tue–Thu, 21:00–23:00, 3.2× baseline risk → recommend patrol.” PULSE turns incident history into patrol plans, SLA scorecards, and a weekly safety brief.',
    module: 'PULSE',
    color: 'text-sev-p3',
  },
]

export function FailurePoints() {
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] })

  return (
    <section ref={sectionRef} className="relative" style={{ height: `${FAILURES.length * 140}vh` }}>
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden">
        <div className="glow-danger absolute inset-0" />

        <header className="relative z-10 mx-auto w-full max-w-5xl px-6 pt-16 sm:pt-20">
          <p className="ops-label text-ops-accent">Where emergencies actually fail</p>
          <h2 className="mt-3 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
            Four failure points. <span className="text-ops-muted">One system that closes them.</span>
          </h2>
        </header>

        <div className="relative z-10 mx-auto grid min-h-[26rem] w-full max-w-5xl flex-1 items-center px-6">
          {FAILURES.map((failure, index) => (
            <Panel
              key={failure.index}
              failure={failure}
              index={index}
              total={FAILURES.length}
              progress={scrollYProgress}
            />
          ))}
        </div>

        {/* Progress rail */}
        <div className="relative z-10 mx-auto mb-10 flex w-full max-w-5xl gap-2 px-6">
          {FAILURES.map((failure, index) => (
            <Tick key={failure.index} index={index} total={FAILURES.length} progress={scrollYProgress} />
          ))}
        </div>
      </div>
    </section>
  )
}

interface PanelProps {
  failure: (typeof FAILURES)[number]
  index: number
  total: number
  progress: MotionValue<number>
}

function Panel({ failure, index, total, progress }: PanelProps) {
  /*
   * Each panel owns one slice of scroll and is driven by an explicit function
   * of progress rather than a keyframe array.
   *
   * The keyframe form was subtly wrong here: with four control points and a
   * flat hold in the middle, the first panel interpolated across the whole
   * range instead of clamping, so it faded back *in* as you scrolled and two
   * panels were visible at once. Computing the local 0–1 position and
   * branching on it is longer, but it says exactly what it does.
   */
  const slice = 1 / total
  const start = index * slice
  const fadePortion = 0.2

  const first = index === 0
  const last = index === total - 1

  /** Where progress sits inside this panel's own slice: <0 before, >1 after. */
  const localPosition = (value: number) => (value - start) / slice

  const opacity = useTransform(progress, (value) => {
    const local = localPosition(value)
    if (local < 0) return first ? 1 : 0
    if (local > 1) return last ? 1 : 0
    if (local < fadePortion) return first ? 1 : local / fadePortion
    if (local > 1 - fadePortion) return last ? 1 : (1 - local) / fadePortion
    return 1
  })

  const y = useTransform(progress, (value) => {
    const local = localPosition(value)
    if (local < 0) return first ? 0 : 28
    if (local > 1) return last ? 0 : -28
    if (local < fadePortion) return first ? 0 : 28 * (1 - local / fadePortion)
    if (local > 1 - fadePortion) return last ? 0 : -28 * (1 - (1 - local) / fadePortion)
    return 0
  })

  /*
   * Hidden panels are stacked in the same grid cell, so they would still take
   * hover and clicks while invisible. Gating pointer events on opacity keeps
   * only the visible panel interactive.
   */
  const pointerEvents = useTransform(opacity, (value) => (value > 0.5 ? 'auto' : 'none'))

  return (
    <motion.article
      style={{ opacity, y, pointerEvents }}
      aria-hidden={undefined}
      className="col-start-1 row-start-1 grid items-start gap-8 sm:grid-cols-[auto_1fr] sm:gap-14"
    >
      <div className={`font-mono text-7xl font-bold tracking-tighter sm:text-9xl ${failure.color}`}>
        {failure.index}
      </div>
      <div className="max-w-xl self-center">
        <p className="text-lg font-medium text-ops-muted line-through decoration-ops-faint/60">
          {failure.problem}
        </p>
        <h3 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {failure.answer}
        </h3>
        <p className="mt-4 text-sm leading-relaxed text-ops-muted sm:text-base">{failure.detail}</p>
        <p className={`ops-label mt-6 ${failure.color}`}>▸ {failure.module}</p>
      </div>
    </motion.article>
  )
}

function Tick({ index, total, progress }: { index: number; total: number; progress: MotionValue<number> }) {
  const fill = useTransform(progress, [index / total, (index + 1) / total], [0, 1])
  const scaleX = useTransform(fill, [0, 1], [0, 1])

  return (
    <div className="h-0.5 flex-1 overflow-hidden rounded bg-ops-border">
      <motion.div style={{ scaleX }} className="h-full origin-left bg-ops-accent" />
    </div>
  )
}
