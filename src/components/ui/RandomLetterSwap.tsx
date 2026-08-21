'use client'

import { motion, useAnimate, type AnimationOptions } from 'framer-motion'
import { useCallback, useRef, useState } from 'react'

/**
 * Headline letters that swap out and back in a shuffled order on hover.
 *
 * The shuffle order is fixed per mount rather than per hover, so repeated
 * hovers replay the same wave — a mannerism, not a slot machine. Screen
 * readers get the plain label; the animated letters are decoration.
 */

const cn = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ')

export interface RandomLetterSwapProps {
  label: string
  /** Swap downward instead of upward. */
  reverse?: boolean
  transition?: AnimationOptions
  staggerDuration?: number
  className?: string
  onClick?: () => void
}

export function RandomLetterSwap({
  label,
  reverse = true,
  transition = { duration: 0.8, type: 'spring' },
  staggerDuration = 0.02,
  className,
  onClick,
}: RandomLetterSwapProps) {
  const [scope, animate] = useAnimate()
  const [running, setRunning] = useState(false)
  const shuffledRef = useRef<number[]>(
    Array.from({ length: label.length }, (_, index) => index).sort(() => Math.random() - 0.5),
  )

  const hoverStart = useCallback(() => {
    if (running) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setRunning(true)

    const shuffled = shuffledRef.current
    for (let i = 0; i < label.length; i++) {
      const index = shuffled[i]
      const staggered: AnimationOptions = { ...transition, delay: i * staggerDuration }

      animate(`.letter-${index}`, { y: reverse ? '100%' : '-100%' }, staggered).then(() => {
        animate(`.letter-${index}`, { y: 0 }, { duration: 0 })
      })

      animate(`.letter-secondary-${index}`, { top: '0%' }, staggered)
        .then(() =>
          animate(
            `.letter-secondary-${index}`,
            { top: reverse ? '-100%' : '100%' },
            { duration: 0 },
          ),
        )
        .then(() => {
          if (i === label.length - 1) setRunning(false)
        })
    }
  }, [running, label, animate, transition, staggerDuration, reverse])

  return (
    <motion.span
      ref={scope}
      aria-label={label}
      onClick={onClick}
      onHoverStart={hoverStart}
      className={cn(
        'relative flex flex-wrap items-center justify-start overflow-hidden',
        className,
      )}
    >
      <span className="sr-only">{label}</span>
      {label.split('').map((letter, index) => (
        <span aria-hidden className="relative flex whitespace-pre" key={index}>
          <motion.span className={`relative pb-2 letter-${index}`} style={{ top: 0 }}>
            {letter}
          </motion.span>
          <motion.span
            className={`absolute letter-secondary-${index}`}
            style={{ top: reverse ? '-100%' : '100%' }}
          >
            {letter}
          </motion.span>
        </span>
      ))}
    </motion.span>
  )
}

export default RandomLetterSwap
