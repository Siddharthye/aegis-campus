'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { RandomLetterSwap } from '@/components/ui/RandomLetterSwap'
import { MagneticButton } from './MagneticButton'

const EASE = [0.22, 1, 0.36, 1] as const

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

  const trackRef = useRef<HTMLDivElement>(null)
  const [slide, setSlide] = useState(0)
  const [held, setHeld] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  const goTo = useCallback((index: number) => {
    const track = trackRef.current
    if (!track) return
    const card = track.children[index] as HTMLElement | undefined
    if (!card) return
    track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: 'smooth' })
    setSlide(index)
  }, [])

  // Autoplay: hold on hover/touch, and never move under reduced motion.
  useEffect(() => {
    if (held || reduceMotion) return
    const timer = setInterval(() => {
      setSlide((current) => {
        const next = (current + 1) % SLIDES.length
        const track = trackRef.current
        const card = track?.children[next] as HTMLElement | undefined
        if (track && card) {
          track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: 'smooth' })
        }
        return next
      })
    }, AUTOPLAY_MS)
    return () => clearInterval(timer)
  }, [held, reduceMotion])

  // Manual swipes move the indicator too: track which card owns the viewport.
  const onScroll = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const cards = Array.from(track.children) as HTMLElement[]
    const centre = track.scrollLeft + track.clientWidth / 2
    const nearest = cards.reduce(
      (best, card, index) => {
        const distance = Math.abs(card.offsetLeft + card.clientWidth / 2 - centre)
        return distance < best.distance ? { index, distance } : best
      },
      { index: 0, distance: Number.POSITIVE_INFINITY },
    )
    setSlide(nearest.index)
  }, [])

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

        <motion.h1
          initial={{ opacity: 0, y: 22, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, delay: 0.45, ease: EASE }}
          className="mt-6 font-[family-name:var(--font-display)] text-5xl font-bold tracking-tight sm:text-6xl xl:text-7xl"
        >
          <RandomLetterSwap label="Every second," className="cursor-default" />
          <RandomLetterSwap label="accounted for." className="cursor-default text-ops-accent" />
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.65, ease: EASE }}
          className="mt-5 max-w-xl text-[15px] leading-relaxed text-ops-muted sm:text-base"
        >
          One platform from the first report to the last responder standing down —
          built for a campus, honest about what it knows.
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

      {/* The capability carousel: floating glass cards, snap + autoplay. */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.95, ease: EASE }}
        className="relative z-10 pb-8"
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
      >
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="scrollbar-none mx-auto flex w-[min(1200px,calc(100%-2rem))] snap-x snap-mandatory gap-4 overflow-x-auto pb-4"
        >
          {SLIDES.map((entry, index) => (
            <Link
              key={entry.id}
              href={entry.href}
              className={`glass-chrome group relative w-[78vw] max-w-[400px] shrink-0 snap-start rounded-2xl p-5 transition-colors sm:w-[360px] ${
                index === slide ? 'border-ops-accent/40' : 'hover:border-ops-accent/30'
              }`}
            >
              <p className="ops-label text-ops-accent">{entry.kicker}</p>
              <p className="mt-2 font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-ops-text">
                {entry.title}
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ops-muted">{entry.body}</p>
              <p className="mt-4 text-[12px] font-semibold text-ops-accent opacity-80 transition-opacity group-hover:opacity-100">
                {entry.cta} →
              </p>
            </Link>
          ))}
        </div>

        {/* Progress: one segment per slide, the active one filling. */}
        <div className="mx-auto mt-1 flex w-[min(1200px,calc(100%-2rem))] gap-1.5">
          {SLIDES.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              aria-label={`Show ${entry.kicker}`}
              onClick={() => goTo(index)}
              className="h-1 flex-1 overflow-hidden rounded-full bg-ops-border/60"
            >
              <span
                className="block h-full origin-left rounded-full bg-ops-accent transition-transform duration-500"
                style={{ transform: index === slide ? 'scaleX(1)' : 'scaleX(0)' }}
              />
            </button>
          ))}
        </div>
      </motion.div>
    </section>
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
