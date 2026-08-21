'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { CampusHologram } from './CampusHologram'
import { MagneticButton } from './MagneticButton'

const EASE = [0.22, 1, 0.36, 1] as const

const HEADLINE_LINES = ['Every second,', 'accounted for.']

const NAV_LINKS = [
  { href: '/control', label: 'Control Room' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/ai', label: 'NEXBOT' },
  { href: '/wanted', label: 'Wanted' },
]

interface LiveStats {
  openIncidents: number
  respondersAvailable: number
  responders: number
  meanResolutionMin: number | null
}

/**
 * The hero as a floating glass slab: one rounded panel hovering over the page
 * ambience, with the campus hologram as its weather. Navigation lives inside
 * the slab, the headline sits editorial-left, live numbers cluster right, and
 * the sellable modules peek over the bottom edge — cut off on purpose, so the
 * fold itself asks you to scroll.
 */
export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] })

  /* Scroll parallax: hologram recedes slower than the copy; both dim. */
  const hologramScale = useTransform(scrollYProgress, [0, 1], [1, 1.08])
  const copyY = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])
  const fade = useTransform(scrollYProgress, [0, 0.65], [1, 0])

  const [stats, setStats] = useState<LiveStats | null>(null)

  useEffect(() => {
    fetch('/api/stats')
      .then((response) => response.json())
      .then(setStats)
      .catch(() => setStats(null)) // The hero must render even with the API down.
  }, [])

  return (
    <section ref={sectionRef} className="relative h-[100svh] p-3 sm:p-5">
      {/* Ambience behind the slab — drifting aurora over the dot grid. */}
      <div className="landing-grid absolute inset-0" />
      <div aria-hidden className="aurora-blob aurora-a left-[8%] top-[10%] size-[45vw]" />
      <div aria-hidden className="aurora-blob aurora-b right-[5%] bottom-[8%] size-[38vw]" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, ease: EASE }}
        className="glass-slab relative flex h-full flex-col overflow-hidden"
      >
        {/* The slab's weather: the campus hologram, dimmed toward the text. */}
        <motion.div style={{ scale: hologramScale }} className="absolute inset-0">
          <CampusHologram className="size-full opacity-80" />
        </motion.div>
        <div className="glow-accent absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-r from-ops-deep/70 via-transparent to-ops-deep/40" />

        {/* Island nav, inside the slab. */}
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
          className="relative z-10 mx-3 mt-3 sm:mx-5 sm:mt-5"
        >
          <div className="glass-chrome flex items-center gap-4 rounded-2xl px-4 py-2.5">
            <Link href="/" className="flex items-center gap-2.5">
              <ShieldMark />
              <span className="font-mono text-sm font-bold tracking-widest">AEGIS</span>
            </Link>

            <div className="mx-auto hidden items-center gap-1 md:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-ops-muted transition-colors hover:bg-ops-panel hover:text-ops-text"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <Link
              href="/report"
              className="ml-auto rounded-full border border-ops-accent/40 bg-ops-accent/10 px-4 py-1.5 text-[13px] font-semibold text-ops-accent transition hover:bg-ops-accent/20 md:ml-0"
            >
              Report →
            </Link>
          </div>
        </motion.nav>

        {/* Editorial copy left, live numbers right. */}
        <motion.div
          style={{ y: copyY, opacity: fade }}
          className="relative z-10 grid flex-1 content-center gap-10 px-6 pb-16 sm:px-10 lg:grid-cols-[1.5fr_1fr] lg:gap-8 lg:px-14"
        >
          <div className="max-w-2xl">
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35, ease: EASE }}
              className="ops-label inline-flex items-center gap-2 rounded-full border border-ops-border bg-ops-panel/70 px-3.5 py-1.5 text-ops-accent"
            >
              <span className="siren-pulse inline-block size-1.5 rounded-full bg-ops-accent" />
              Campus Emergency Response OS
            </motion.p>

            <h1 className="mt-6 text-5xl font-bold tracking-tight text-balance sm:text-6xl xl:text-7xl">
              {HEADLINE_LINES.map((line, lineIndex) => (
                <span key={line} className="block overflow-hidden">
                  <motion.span
                    initial={{ y: '110%', opacity: 0, filter: 'blur(8px)' }}
                    animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.9, delay: 0.4 + lineIndex * 0.12, ease: EASE }}
                    className={`block ${lineIndex === 1 ? 'text-ops-accent' : ''}`}
                  >
                    {line}
                  </motion.span>
                </span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.65, ease: EASE }}
              className="mt-5 max-w-xl text-[15px] leading-relaxed text-ops-muted sm:text-base"
            >
              Report in three taps. Locate to the room, not the block. Fuse fifty duplicate
              reports into one incident. Dispatch the nearest responder — with an SLA clock
              running on every second.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8, ease: EASE }}
              className="mt-8 flex flex-wrap items-center gap-4"
            >
              <MagneticButton href="/control">Open Control Room →</MagneticButton>
              <MagneticButton href="/ai" variant="ghost">
                Ask NEXBOT
              </MagneticButton>
            </motion.div>
          </div>

          {/* The Orbite-style stat cluster: big numbers, small truths. */}
          <motion.aside
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9, ease: EASE }}
            className="hidden self-center lg:block"
          >
            <div className="grid grid-cols-3 gap-6">
              <HeroStat value={stats?.openIncidents ?? 0} label="open incidents" live={stats !== null} />
              <HeroStat
                value={stats?.respondersAvailable ?? 0}
                suffix={stats ? `/${stats.responders}` : ''}
                label="responders ready"
                live={stats !== null}
              />
              <HeroStat
                value={stats?.meanResolutionMin != null ? Math.round(stats.meanResolutionMin) : 0}
                suffix="m"
                label="mean resolution"
                live={stats !== null}
              />
            </div>

            <p className="mt-6 max-w-xs text-[12px] leading-relaxed text-ops-faint">
              Live from the incident store over SSE. Six subsystems — SENTINEL, BEACON, FUSION,
              SIREN, PULSE, DRILL — behind four seats, all of it running with the wifi off.
            </p>

            <div className="mt-5 flex gap-2.5">
              <Link
                href="/wanted"
                className="ops-label rounded-full border border-ops-border px-3.5 py-2 text-ops-muted transition-colors hover:border-ops-accent/40 hover:text-ops-text"
              >
                What we buy
              </Link>
              <Link
                href="#modules"
                className="ops-label rounded-full border border-ops-border px-3.5 py-2 text-ops-muted transition-colors hover:border-ops-accent/40 hover:text-ops-text"
              >
                What we sell
              </Link>
            </div>
          </motion.aside>
        </motion.div>

      </motion.div>
    </section>
  )
}

function HeroStat({
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
    <div>
      <p className="font-mono text-3xl font-bold text-ops-text">
        {live ? <AnimatedNumber value={value} suffix={suffix} /> : '—'}
      </p>
      <p className="ops-label mt-1 text-ops-faint">{label}</p>
    </div>
  )
}

function ShieldMark() {
  return (
    <svg width="20" height="22" viewBox="0 0 20 22" fill="none" aria-hidden>
      <path
        d="M10 1 18.5 4.5v6c0 5.2-3.6 8.9-8.5 10.5C5.1 19.4 1.5 15.7 1.5 10.5v-6L10 1Z"
        stroke="#38bdf8"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10.5" r="2.2" fill="#38bdf8" />
    </svg>
  )
}
