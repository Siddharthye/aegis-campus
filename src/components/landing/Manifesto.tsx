'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { MagneticButton } from './MagneticButton'

const WORDS =
  'When something goes wrong on a campus, the difference between a close call and a tragedy is measured in seconds. AEGIS exists so none of them are wasted.'.split(' ')

/**
 * Closing statement: each word sharpens from dim to bright as scroll passes
 * over it — the Apple keynote text reveal — then the final CTAs.
 */
export function Manifesto() {
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 0.85', 'end 0.45'],
  })

  return (
    <section ref={sectionRef} className="relative mx-auto max-w-4xl px-6 py-32 sm:py-44">
      <div className="glow-accent absolute inset-0" />

      <p className="relative flex flex-wrap justify-center gap-x-[0.3em] gap-y-2 text-center text-2xl font-semibold tracking-tight text-balance sm:text-4xl">
        {WORDS.map((word, index) => (
          <Word key={`${word}-${index}`} word={word} index={index} total={WORDS.length} progress={scrollYProgress} />
        ))}
      </p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative mt-14 flex flex-wrap items-center justify-center gap-4"
      >
        <MagneticButton href="/control">Open Control Room →</MagneticButton>
        <MagneticButton href="/report" variant="ghost">
          File a Report
        </MagneticButton>
      </motion.div>

      <p className="ops-label relative mt-10 text-center text-ops-faint">
        Team PROMPT &amp; PRAY · HACQUIRE 2026 · PS-01 Smart Campus Emergency Response
      </p>
    </section>
  )
}

function Word({
  word,
  index,
  total,
  progress,
}: {
  word: string
  index: number
  total: number
  progress: ReturnType<typeof useScroll>['scrollYProgress']
}) {
  const start = index / total
  const end = start + 1 / total
  const opacity = useTransform(progress, [start, end], [0.18, 1])

  return (
    <motion.span style={{ opacity }} className="inline-block">
      {word}
    </motion.span>
  )
}
