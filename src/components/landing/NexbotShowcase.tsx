'use client'

import { motion } from 'framer-motion'
import { NexbotAvatar } from '@/components/nexbot/NexbotAvatar'

const EASE = [0.22, 1, 0.36, 1] as const

/** What NEXBOT can actually answer, phrased as a dispatcher would ask it. */
const CAPABILITIES = [
  { ask: 'What needs attention?', answers: 'Open incidents ranked by SLA pressure' },
  { ask: 'Any SLA breaches?', answers: 'Every clock past its target, with how far past' },
  { ask: 'Who is free right now?', answers: 'Available responders by unit and distance' },
  { ask: 'inc-4f9a12c0', answers: 'That incident, its timeline, and what to do next' },
]

/**
 * The NEXBOT section — Spline stage on the left (towerz pattern), copy on the
 * right. The claim being made here is the unusual one: this assistant answers
 * with no model behind it.
 */
export function NexbotShowcase() {
  return (
    <section className="relative overflow-hidden py-28">
      <div className="glow-accent absolute inset-0 opacity-60" />

      <div className="relative mx-auto grid max-w-5xl items-center gap-12 px-6 md:grid-cols-[1.05fr_1fr]">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="relative mx-auto w-full"
        >
          <div className="relative aspect-square w-full max-w-[420px] overflow-hidden rounded-2xl border border-ops-border bg-ops-deep mx-auto shadow-[0_0_60px_rgba(56,189,248,0.12)]">
            <div className="absolute inset-0 grid place-items-center">
              <NexbotAvatar size={200} />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_35%,rgba(5,7,13,0.55)_100%)]" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
        >
          <p className="ops-label text-ops-accent">NEXBOT · ops copilot</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            It answers without asking anyone.
          </h2>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ops-muted">
            No model, no API key, no round trip to a vendor. NEXBOT reads the live incident
            store and answers in the time it takes to render — which means it still answers
            when the venue wifi does not.
          </p>

          <ul className="mt-7 flex flex-col gap-2.5">
            {CAPABILITIES.map((capability, index) => (
              <motion.li
                key={capability.ask}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, ease: EASE, delay: 0.15 + index * 0.07 }}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-l border-ops-border pl-4"
              >
                <span className="font-mono text-[13px] text-ops-text">
                  &ldquo;{capability.ask}&rdquo;
                </span>
                <span className="text-[12px] text-ops-faint">{capability.answers}</span>
              </motion.li>
            ))}
          </ul>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <a
              href="/ai"
              className="rounded-full border border-ops-accent/40 bg-ops-accent/10 px-5 py-2.5 text-[13px] font-semibold text-ops-accent transition hover:bg-ops-accent/20"
            >
              Open the NEXBOT console →
            </a>
            <p className="text-[12px] text-ops-faint">
              Or tap the robot in the corner — it tracks your cursor.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
