'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { CampusHologram } from './CampusHologram'
import { MagneticButton } from './MagneticButton'

const EASE = [0.22, 1, 0.36, 1] as const

const HEADLINE_LINES = ['Every second,', 'accounted for.']

interface LiveStats {
  openIncidents: number
  respondersAvailable: number
  responders: number
  meanResolutionMin: number | null
}

/**
 * Full-viewport hero. The campus hologram sits behind kinetic type; the whole
 * scene parallax-recedes as you scroll into the story below. All scroll motion
 * is useTransform-driven — zero React re-renders while scrolling.
 */
export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] })

  /* Scroll parallax: hologram recedes slower than the text, and both dim. */
  const hologramY = useTransform(scrollYProgress, [0, 1], ['0%', '18%'])
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '55%'])
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.08])

  const [stats, setStats] = useState<LiveStats | null>(null)

  useEffect(() => {
    fetch('/api/stats')
      .then((response) => response.json())
      .then(setStats)
      .catch(() => setStats(null)) // The hero must render even with the API down.
  }, [])

  return (
    <section ref={sectionRef} className="relative h-[100svh] overflow-hidden">
      {/* Layer 0 — dot grid + glow */}
      <div className="landing-grid absolute inset-0" />
      <div className="glow-accent absolute inset-0" />

      {/* Layer 1 — the hologram */}
      <motion.div style={{ y: hologramY, scale, opacity: fade }} className="absolute inset-0">
        <CampusHologram className="size-full" />
      </motion.div>

      {/* Layer 2 — copy */}
      <motion.div
        style={{ y: textY, opacity: fade }}
        className="relative z-10 mx-auto flex h-full max-w-5xl flex-col items-center justify-center px-6 text-center"
      >
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="ops-label flex items-center gap-2 rounded-full border border-ops-border bg-ops-panel/70 px-4 py-2 text-ops-accent backdrop-blur-sm"
        >
          <span className="siren-pulse inline-block size-1.5 rounded-full bg-ops-accent" />
          AEGIS · Campus Emergency Response OS
        </motion.p>

        <h1 className="mt-8 text-5xl font-bold tracking-tight text-balance sm:text-7xl">
          {HEADLINE_LINES.map((line, lineIndex) => (
            <span key={line} className="block overflow-hidden">
              <motion.span
                initial={{ y: '110%', opacity: 0, filter: 'blur(8px)' }}
                animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.9, delay: 0.15 + lineIndex * 0.12, ease: EASE }}
                className={`block ${lineIndex === 1 ? 'text-ops-accent' : ''}`}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
          className="mt-6 max-w-2xl text-base leading-relaxed text-ops-muted sm:text-lg"
        >
          Report in three taps. Locate to the room, not the block. Fuse fifty duplicate
          reports into one incident. Dispatch the nearest responder — with an SLA clock
          running on every second.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.65, ease: EASE }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <MagneticButton href="/control">Open Control Room →</MagneticButton>
          <MagneticButton href="/report" variant="ghost">
            File a Report
          </MagneticButton>
        </motion.div>
      </motion.div>

      {/* Layer 3 — live stat ticker */}
      <motion.footer
        style={{ opacity: fade }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.8 }}
        className="absolute inset-x-0 bottom-0 z-10 border-t border-ops-border/60 bg-ops-deep/70 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-2 px-6 py-4">
          <Stat label="Open incidents" value={stats ? String(stats.openIncidents) : '—'} />
          <Stat
            label="Responders ready"
            value={stats ? `${stats.respondersAvailable}/${stats.responders}` : '—'}
          />
          <Stat
            label="Mean resolution"
            value={stats?.meanResolutionMin != null ? `${stats.meanResolutionMin}m` : '—'}
          />
          <Stat label="Live feed" value="SSE · realtime" accent />
        </div>
      </motion.footer>

      {/* Scroll cue */}
      <motion.div
        style={{ opacity: fade }}
        className="absolute bottom-20 left-1/2 z-10 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
      >
        <div className="h-8 w-px bg-gradient-to-b from-transparent via-ops-accent/60 to-transparent" />
      </motion.div>
    </section>
  )
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={`font-mono text-sm font-bold ${accent ? 'text-ops-accent' : 'text-ops-text'}`}>
        {value}
      </span>
      <span className="ops-label text-ops-faint">{label}</span>
    </div>
  )
}
