'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import Link from 'next/link'

const LINKS = [
  { href: '/report', label: 'Report' },
  { href: '/control', label: 'Control Room' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/case', label: 'Check a case' },
  { href: '/wanted', label: 'Wanted' },
]

/**
 * Floating glass nav. Transparent over the hero; gains its panel as soon as
 * scrolling starts. backdrop-blur is confined to this one small bar.
 */
export function LandingNav() {
  const { scrollY } = useScroll()
  const background = useTransform(scrollY, [0, 120], ['rgba(10, 14, 23, 0)', 'rgba(10, 14, 23, 0.82)'])
  const borderColor = useTransform(scrollY, [0, 120], ['rgba(31, 41, 55, 0)', 'rgba(31, 41, 55, 1)'])

  return (
    <motion.nav
      style={{ background, borderColor }}
      className="fixed inset-x-0 top-0 z-50 border-b backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5">
          <ShieldMark />
          <span className="font-mono text-sm font-bold tracking-widest">AEGIS</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-ops-muted transition-colors hover:bg-ops-panel hover:text-ops-text"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Below md the full row would wrap into the logo, so the two links a
            student actually needs stay and the rest live in the console. */}
        <div className="flex items-center gap-1 md:hidden">
          {LINKS.slice(0, 1).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-1.5 text-[13px] font-medium text-ops-muted transition-colors hover:text-ops-text"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <Link
          href="/control"
          className="rounded-full border border-ops-accent/40 bg-ops-accent/10 px-4 py-1.5 text-[13px] font-semibold text-ops-accent transition hover:bg-ops-accent/20"
        >
          Launch console
        </Link>
      </div>
    </motion.nav>
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
