'use client'

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'
import { Eye, Merge, Radar, ShieldAlert, Siren } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { RandomLetterSwap } from '@/components/ui/RandomLetterSwap'
import { MagneticButton } from './MagneticButton'

const EASE = [0.22, 1, 0.36, 1] as const

/** How long a slide holds before the carousel advances on its own. */
const AUTOPLAY_MS = 5000

const SUPPORT_WORDS =
  'One platform from the first report to the last responder standing down — built for a campus, honest about what it knows.'.split(
    ' ',
  )

/**
 * The capabilities the carousel presents. Presentation only — every entry is
 * a screen that already exists, described in the words the site already uses.
 */
const SLIDES = [
  {
    id: 'report',
    kicker: 'REPORT',
    title: 'Three taps to help',
    body: 'Category, location, send. Picking the room on the floor plan pins it to the exact space — dispatched to a door, not a building.',
    href: '/report',
    cta: 'File a report',
    icon: Siren,
  },
  {
    id: 'sentinel',
    kicker: 'SENTINEL',
    title: 'Silent when it must be',
    body: 'Triple-tap arms a decoy screen while location streams silently. A PIN stands between the alarm and anyone who takes the phone.',
    href: '/report',
    cta: 'See silent mode',
    icon: ShieldAlert,
  },
  {
    id: 'fusion',
    kicker: 'FUSION',
    title: 'Fifty reports. One incident.',
    body: 'Duplicates fuse on intake, confidence climbs with every corroborating voice, and the control room reads one truth instead of a flood.',
    href: '/control',
    cta: 'Open the control room',
    icon: Merge,
  },
  {
    id: 'control',
    kicker: 'CONTROL ROOM',
    title: 'The clock decides the order',
    body: 'One queue ranked by SLA pressure, dispatch recommendations reasoned in plain language, and a geofenced broadcast a human reads first.',
    href: '/control',
    cta: 'Open the control room',
    icon: Radar,
  },
  {
    id: 'sightline',
    kicker: 'SIGHTLINE',
    title: 'Which way to walk tonight',
    body: 'Routes ranked by what has actually been reported near them at this hour — from different people, so one account cannot reroute a campus.',
    href: '/safe-walk',
    cta: 'Start a Safe Walk',
    icon: Eye,
  },
] as const

interface LiveStats {
  openIncidents: number
  respondersAvailable: number
  responders: number
  meanResolutionMin: number | null
}

/**
 * The hero as a layered cinematic composition over the liquid-gradient
 * atmosphere (which is untouched — it lives behind the whole page).
 *
 * Three planes of depth: the island nav; the copy plane, which drifts a few
 * pixels against the pointer; and the carousel slab, which tilts under a
 * degree toward it. A live-ops capsule floats in the aurora on wide screens,
 * fed by the stats endpoint the site already exposes.
 *
 * The carousel runs like a story: the active progress segment fills across
 * the autoplay window, freezes while the pointer rests on the slab, and the
 * slide itself can be dragged — touch gets a first-class gesture instead of
 * a smaller mouse.
 */
export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })
  const copyY = useTransform(scrollYProgress, [0, 1], ['0%', '28%'])
  const fade = useTransform(scrollYProgress, [0, 0.65], [1, 0])

  const [slide, setSlide] = useState(0)
  const [held, setHeld] = useState(false)
  /* Bumped when a hold releases, so the autoplay timer and the progress fill
     restart from zero together instead of drifting apart. */
  const [cycle, setCycle] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [finePointer, setFinePointer] = useState(false)
  const [stats, setStats] = useState<LiveStats | null>(null)

  useEffect(() => {
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    setFinePointer(window.matchMedia('(pointer: fine)').matches)
  }, [])

  useEffect(() => {
    fetch('/api/stats')
      .then((response) => response.json())
      .then(setStats)
      .catch(() => setStats(null)) // The hero must render even with the API down.
  }, [])

  useEffect(() => {
    if (held || reduceMotion) return
    const timer = setTimeout(
      () => setSlide((current) => (current + 1) % SLIDES.length),
      AUTOPLAY_MS,
    )
    return () => clearTimeout(timer)
  }, [slide, held, cycle, reduceMotion])

  const release = () => {
    setHeld(false)
    setCycle((current) => current + 1)
  }

  /* Pointer parallax: normalised cursor position, spring-smoothed, driving
     each plane by a different amount. Motion values only — no re-renders. */
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const drift = { stiffness: 60, damping: 18, mass: 0.8 }
  const springX = useSpring(pointerX, drift)
  const springY = useSpring(pointerY, drift)
  const copyDriftX = useTransform(springX, [-1, 1], [7, -7])
  const copyDriftY = useTransform(springY, [-1, 1], [5, -5])
  const capsuleDriftX = useTransform(springX, [-1, 1], [-14, 14])
  const capsuleDriftY = useTransform(springY, [-1, 1], [-9, 9])
  const slabTiltX = useTransform(springY, [-1, 1], [0.8, -0.8])
  const slabTiltY = useTransform(springX, [-1, 1], [-0.9, 0.9])

  useEffect(() => {
    if (!finePointer || reduceMotion) return
    const onMove = (event: PointerEvent) => {
      pointerX.set((event.clientX / window.innerWidth) * 2 - 1)
      pointerY.set((event.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [finePointer, reduceMotion, pointerX, pointerY])

  const parallax = finePointer && !reduceMotion
  const active = SLIDES[slide]

  return (
    <section ref={sectionRef} className="relative flex min-h-[100svh] flex-col overflow-hidden">
      {/* Island nav, floating over the atmosphere. */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
        className="relative z-10 mx-auto mt-5 w-[min(1200px,calc(100%-2rem))]"
      >
        <div className="glass-chrome flex items-center gap-4 rounded-2xl px-4 py-2">
          <Link href="/" className="flex min-h-11 items-center gap-2.5">
            <ShieldMark />
            <span className="font-mono text-sm font-bold tracking-widest">AEGIS</span>
          </Link>

          <Link
            href="/report"
            className="ml-auto inline-flex min-h-11 items-center rounded-full border border-ops-accent/40 bg-ops-accent/10 px-4 text-[13px] font-semibold text-ops-accent transition hover:bg-ops-accent/20"
          >
            Report →
          </Link>
        </div>
      </motion.nav>

      <div className="relative z-10 flex flex-1 flex-col justify-center">
      {/* Copy plane left, live-ops capsule floating in the aurora right. */}
      <motion.div
        style={{ y: copyY, opacity: fade }}
        className="mx-auto grid w-[min(1200px,calc(100%-2rem))] gap-8 py-6 xl:grid-cols-[1.35fr_auto] xl:items-center xl:gap-12"
      >
        <motion.div style={parallax ? { x: copyDriftX, y: copyDriftY } : undefined}>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
            className="ops-label inline-flex w-fit items-center gap-2 rounded-full border border-ops-accent/25 bg-ops-panel/70 px-3.5 py-1.5 text-ops-accent shadow-[0_0_24px_rgba(167,139,250,0.15)]"
          >
            <span className="siren-pulse inline-block size-1.5 rounded-full bg-ops-accent" />
            Campus Emergency Response OS
          </motion.p>

          {/* The headline stands still until hovered — the letter swap is the
              only animation it ever performs. */}
          <h1 className="mt-5 font-[family-name:var(--font-display)] text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl xl:text-8xl">
            <RandomLetterSwap label="Every second," className="cursor-default" />
            {/* Solid accent, deliberately: background-clip text under the
                swap's transformed letters makes Chromium paint the line twice. */}
            <RandomLetterSwap label="accounted for." className="cursor-default text-ops-accent" />
          </h1>

          {/* The support line brightens word by word as scrolling begins. */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
            className="mt-5 flex max-w-xl flex-wrap gap-x-[0.3em] text-[15px] leading-relaxed sm:text-base"
          >
            {SUPPORT_WORDS.map((word, index) => (
              <SupportWord
                key={`${word}-${index}`}
                word={word}
                index={index}
                total={SUPPORT_WORDS.length}
                progress={scrollYProgress}
              />
            ))}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.65, ease: EASE }}
            className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <MagneticButton href="/control">Open Control Room →</MagneticButton>
            <MagneticButton href="/ai" variant="ghost">
              Ask NEXBOT
            </MagneticButton>
          </motion.div>
        </motion.div>

        {/* Live proof, floating deeper in the parallax than the copy. Wide
            screens only — the first phone viewport stays uncluttered. */}
        <motion.aside
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.8, ease: EASE }}
          style={parallax ? { x: capsuleDriftX, y: capsuleDriftY } : undefined}
          className="hidden xl:block"
        >
          <div className="glass-chrome w-[280px] rounded-2xl p-5">
            <p className="ops-label flex items-center gap-2 text-ops-muted">
              <span className="siren-pulse size-1.5 rounded-full bg-emerald-400" />
              Live from the incident store
            </p>

            <dl className="mt-4 space-y-4">
              <CapsuleStat
                value={stats?.openIncidents ?? 0}
                label="open incidents"
                live={stats !== null}
              />
              <CapsuleStat
                value={stats?.respondersAvailable ?? 0}
                suffix={stats ? `/${stats.responders}` : ''}
                label="responders ready"
                live={stats !== null}
              />
              <CapsuleStat
                value={stats?.meanResolutionMin != null ? Math.round(stats.meanResolutionMin) : 0}
                suffix="m"
                label="mean resolution"
                live={stats !== null}
              />
            </dl>

            <p className="mt-4 border-t border-ops-border/60 pt-3 text-[11px] leading-relaxed text-ops-faint">
              Six subsystems behind four seats, all of it running with the wifi off.
            </p>
          </div>
        </motion.aside>
      </motion.div>

      {/* The capability carousel: one slide at a time on a tilting glass
          slab. Autoplay fills the progress segment; a drag advances it. */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.9, ease: EASE }}
        className="mt-8 pb-24 sm:mt-10 sm:pb-8"
        style={{ perspective: 1200 }}
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={release}
      >
        <motion.div
          style={parallax ? { rotateX: slabTiltX, rotateY: slabTiltY } : undefined}
          className="glass-chrome relative mx-auto w-[min(1200px,calc(100%-2rem))] overflow-hidden rounded-2xl"
        >
          {/* A light streak sweeps the slab once per slide change. */}
          {!reduceMotion && (
            <motion.span
              key={`sheen-${slide}`}
              aria-hidden
              initial={{ x: '-130%' }}
              animate={{ x: '130%' }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"
            />
          )}

          <span className="ops-label pointer-events-none absolute right-4 top-3 text-ops-faint">
            {String(slide + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
          </span>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active.id}
              initial={reduceMotion ? false : { opacity: 0, x: 56 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -56 }}
              transition={{ duration: 0.45, ease: EASE }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.16}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) setSlide((current) => (current + 1) % SLIDES.length)
                else if (info.offset.x > 60)
                  setSlide((current) => (current + SLIDES.length - 1) % SLIDES.length)
              }}
              style={{ touchAction: 'pan-y' }}
              className="grid min-h-[190px] cursor-grab gap-3 p-6 active:cursor-grabbing sm:min-h-[168px] sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-8 sm:px-16 sm:py-8"
            >
              <div className="flex items-center gap-3 sm:w-32 sm:flex-col sm:items-start">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-ops-accent/30 bg-ops-accent/10 text-ops-accent">
                  <active.icon className="size-5" aria-hidden />
                </span>
                <p className="ops-label text-ops-accent">{active.kicker}</p>
              </div>

              <div>
                <p className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-ops-text sm:text-3xl">
                  {active.title}
                </p>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ops-muted sm:text-sm">
                  {active.body}
                </p>
              </div>

              <Link
                href={active.href}
                className="inline-flex min-h-11 w-fit items-center rounded-full border border-ops-accent/40 bg-ops-accent/10 px-4 text-[13px] font-semibold text-ops-accent transition hover:bg-ops-accent/20"
              >
                {active.cta} →
              </Link>
            </motion.div>
          </AnimatePresence>

          <CarouselArrow
            direction="previous"
            onClick={() => setSlide((current) => (current + SLIDES.length - 1) % SLIDES.length)}
          />
          <CarouselArrow
            direction="next"
            onClick={() => setSlide((current) => (current + 1) % SLIDES.length)}
          />
        </motion.div>

        {/* Story-style progress: past segments full, the active one filling
            across the autoplay window, frozen while the slab is held. */}
        <div className="mx-auto mt-3 flex w-[min(1200px,calc(100%-2rem))] gap-1.5">
          {SLIDES.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              aria-label={`Show ${entry.kicker}`}
              onClick={() => setSlide(index)}
              className="group flex h-11 flex-1 items-center sm:h-4"
            >
              <span className="block h-1 w-full overflow-hidden rounded-full bg-ops-border/60 transition-colors group-hover:bg-ops-border">
                {index < slide || (reduceMotion && index === slide) ? (
                  <span className="block h-full rounded-full bg-ops-accent" />
                ) : index === slide ? (
                  <span
                    key={`fill-${slide}-${cycle}`}
                    className="carousel-fill block h-full rounded-full bg-ops-accent"
                    style={{
                      animationDuration: `${AUTOPLAY_MS}ms`,
                      animationPlayState: held ? 'paused' : 'running',
                    }}
                  />
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </motion.div>
      </div>
    </section>
  )
}

/**
 * One word of the hero's support line. Dim at rest; sharpens to full text
 * colour across the first quarter of the hero's scroll, in reading order.
 */
function SupportWord({
  word,
  index,
  total,
  progress,
}: {
  word: string
  index: number
  total: number
  progress: MotionValue<number>
}) {
  const start = 0.02 + (index / total) * 0.22
  const color = useTransform(
    progress,
    [start, start + 0.22 / total + 0.04],
    ['var(--color-ops-faint)', 'var(--color-ops-text)'],
  )

  return (
    <motion.span style={{ color }} className="inline-block">
      {word}
    </motion.span>
  )
}

function CapsuleStat({
  value,
  suffix = '',
  label,
  live,
}: {
  value: number
  suffix?: string
  label: string
  live: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dd className="font-mono text-2xl font-bold text-ops-text">
        {live ? <AnimatedNumber value={value} suffix={suffix} /> : '—'}
      </dd>
      <dt className="ops-label text-ops-faint">{label}</dt>
    </div>
  )
}

function CarouselArrow({
  direction,
  onClick,
}: {
  direction: 'previous' | 'next'
  onClick: () => void
}) {
  const next = direction === 'next'
  return (
    <button
      type="button"
      aria-label={`${next ? 'Next' : 'Previous'} capability`}
      onClick={onClick}
      className={`absolute top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-ops-border bg-ops-panel/80 text-ops-muted transition hover:border-ops-accent/40 hover:text-ops-text sm:grid ${
        next ? 'right-3' : 'left-3'
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path
          d={next ? 'M5 2.5 9.5 7 5 11.5' : 'M9 2.5 4.5 7 9 11.5'}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

function ShieldMark() {
  return (
    <svg width="20" height="22" viewBox="0 0 20 22" fill="none" aria-hidden>
      <path
        d="M10 1 18.5 4.5v6c0 5.2-3.6 8.9-8.5 10.5C5.1 19.4 1.5 15.7 1.5 10.5v-6L10 1Z"
        stroke="#a78bfa"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10.5" r="2.2" fill="#a78bfa" />
    </svg>
  )
}
