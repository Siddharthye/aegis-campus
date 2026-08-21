'use client'

import { AnimatePresence, motion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { RandomLetterSwap } from '@/components/ui/RandomLetterSwap'
import { MagneticButton } from './MagneticButton'

const EASE = [0.22, 1, 0.36, 1] as const

const SUPPORT_WORDS =
  'One platform from the first report to the last responder standing down — built for a campus, honest about what it knows.'.split(
    ' ',
  )

/** Seconds a slide holds before the carousel advances on its own. */
const AUTOPLAY_MS = 4500

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
  },
  {
    id: 'sentinel',
    kicker: 'SENTINEL',
    title: 'Silent when it must be',
    body: 'Triple-tap arms a decoy screen while location streams silently. A PIN stands between the alarm and anyone who takes the phone.',
    href: '/report',
    cta: 'See silent mode',
  },
  {
    id: 'fusion',
    kicker: 'FUSION',
    title: 'Fifty reports. One incident.',
    body: 'Duplicates fuse on intake, confidence climbs with every corroborating voice, and the control room reads one truth instead of a flood.',
    href: '/control',
    cta: 'Open the control room',
  },
  {
    id: 'control',
    kicker: 'CONTROL ROOM',
    title: 'The clock decides the order',
    body: 'One queue ranked by SLA pressure, dispatch recommendations reasoned in plain language, and a geofenced broadcast a human reads first.',
    href: '/control',
    cta: 'Open the control room',
  },
  {
    id: 'sightline',
    kicker: 'SIGHTLINE',
    title: 'Which way to walk tonight',
    body: 'Routes ranked by what has actually been reported near them at this hour — from different people, so one account cannot reroute a campus.',
    href: '/safe-walk',
    cta: 'Start a Safe Walk',
  },
] as const

/**
 * The hero as a cinematic opening: the liquid-gradient atmosphere behind
 * everything, a floating island nav, the headline set in the display face,
 * and the product introduced by a self-advancing carousel of glass cards.
 *
 * First viewport carries brand, headline, one support line, the CTAs, and the
 * carousel — the numbers now live further down the page where they have room
 * to mean something.
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
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  // Autoplay: hold under the pointer, and never move under reduced motion.
  useEffect(() => {
    if (held || reduceMotion) return
    const timer = setInterval(() => {
      setSlide((current) => (current + 1) % SLIDES.length)
    }, AUTOPLAY_MS)
    return () => clearInterval(timer)
  }, [held, reduceMotion])

  return (
    <section ref={sectionRef} className="relative flex min-h-[100svh] flex-col overflow-hidden">
      {/* Island nav, floating over the atmosphere. */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
        className="relative z-10 mx-auto mt-5 w-[min(1200px,calc(100%-2rem))]"
      >
        <div className="glass-chrome flex items-center gap-4 rounded-2xl px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <ShieldMark />
            <span className="font-mono text-sm font-bold tracking-widest">AEGIS</span>
          </Link>

          <Link
            href="/report"
            className="ml-auto rounded-full border border-ops-accent/40 bg-ops-accent/10 px-4 py-1.5 text-[13px] font-semibold text-ops-accent transition hover:bg-ops-accent/20"
          >
            Report →
          </Link>
        </div>
      </motion.nav>

      {/* Brand, headline, one support line, the CTAs. */}
      <motion.div
        style={{ y: copyY, opacity: fade }}
        className="relative z-10 mx-auto flex w-[min(1200px,calc(100%-2rem))] flex-1 flex-col justify-center py-12"
      >
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
          className="ops-label inline-flex w-fit items-center gap-2 rounded-full border border-ops-border bg-ops-panel/70 px-3.5 py-1.5 text-ops-accent"
        >
          <span className="siren-pulse inline-block size-1.5 rounded-full bg-ops-accent" />
          Campus Emergency Response OS
        </motion.p>

        {/* The headline stands still until hovered — the letter swap is the
            only animation it ever performs. */}
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-5xl font-bold tracking-tight sm:text-6xl xl:text-7xl">
          <RandomLetterSwap label="Every second," className="cursor-default" />
          <RandomLetterSwap label="accounted for." className="cursor-default text-ops-accent" />
        </h1>

        {/* The support line brightens word by word as scrolling begins,
            then rides the section's fade out with everything else. */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.65, ease: EASE }}
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
          transition={{ duration: 0.8, delay: 0.78, ease: EASE }}
          className="mt-8 flex flex-wrap items-center gap-4"
        >
          <MagneticButton href="/control">Open Control Room →</MagneticButton>
          <MagneticButton href="/ai" variant="ghost">
            Ask NEXBOT
          </MagneticButton>
        </motion.div>
      </motion.div>

      {/* The carousel: one capability at a time on a wide glass slab —
          autoplay that holds under the pointer, arrows, and a segmented
          progress bar. Presentation only; every slide is an existing screen. */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
        className="relative z-10 pb-8"
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
      >
        <div className="glass-chrome relative mx-auto w-[min(1200px,calc(100%-2rem))] overflow-hidden rounded-2xl">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={SLIDES[slide].id}
              initial={reduceMotion ? false : { opacity: 0, x: 56 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -56 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="grid min-h-[168px] gap-2 p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-8 sm:px-16 sm:py-8"
            >
              <p className="ops-label w-28 text-ops-accent">{SLIDES[slide].kicker}</p>
              <div>
                <p className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-ops-text sm:text-3xl">
                  {SLIDES[slide].title}
                </p>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ops-muted sm:text-sm">
                  {SLIDES[slide].body}
                </p>
              </div>
              <Link
                href={SLIDES[slide].href}
                className="w-fit rounded-full border border-ops-accent/40 bg-ops-accent/10 px-4 py-2 text-[13px] font-semibold text-ops-accent transition hover:bg-ops-accent/20"
              >
                {SLIDES[slide].cta} &rarr;
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
        </div>

        {/* Progress: one segment per slide, the active one filled. */}
        <div className="mx-auto mt-3 flex w-[min(1200px,calc(100%-2rem))] gap-1.5">
          {SLIDES.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              aria-label={`Show ${entry.kicker}`}
              onClick={() => setSlide(index)}
              className="group flex h-11 flex-1 items-center sm:h-4"
            >
              <span className="block h-1 w-full overflow-hidden rounded-full bg-ops-border/60">
                <span
                  className="block h-full origin-left rounded-full bg-ops-accent transition-transform duration-500"
                  style={{ transform: index === slide ? 'scaleX(1)' : 'scaleX(0)' }}
                />
              </span>
            </button>
          ))}
        </div>
      </motion.div>

    </section>
  )
}

/**
 * One word of the hero's support line. Dim at rest; sharpens to full text
 * colour across the first quarter of the hero's scroll, in reading order —
 * the same reveal the closing statement uses, tuned for a line this short.
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
      className={`absolute top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full border border-ops-border bg-ops-panel/80 text-ops-muted transition hover:border-ops-accent/40 hover:text-ops-text sm:grid ${
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
