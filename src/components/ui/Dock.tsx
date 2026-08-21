'use client'

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'
import {
  Activity,
  Command,
  FileSearch,
  Navigation,
  QrCode,
  Radar,
  Shield,
  Siren,
  Store,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState } from 'react'
import { NexbotAvatar } from '@/components/nexbot/NexbotAvatar'

/**
 * The dock — macOS-style bottom navigation, and the only taskbar AEGIS has.
 *
 * Icons magnify as the cursor approaches, driven by one shared mouse-x motion
 * value: each item measures its distance from the cursor and springs its own
 * size from that. Everything is transform/opacity work off the React render
 * path, which is what keeps it at 60fps while a live console updates behind
 * it. On touch there is no cursor, so there is no magnification — items stay
 * at rest size instead of jumping to wherever a tap lands.
 */

/** Rest and peak icon-tile sizes, and the cursor radius that magnifies. */
const TILE_REST_PX = 44
const TILE_PEAK_PX = 76
const MAGNIFY_RADIUS_PX = 150

type DockEntry =
  | { kind: 'link'; href: string; label: string; icon: React.ReactNode; desktopOnly?: boolean }
  | { kind: 'nexbot'; href: string; label: string }
  | { kind: 'palette'; label: string }
  | { kind: 'gap' }

const ICON = 'size-5 text-ops-text'

const ENTRIES: DockEntry[] = [
  { kind: 'link', href: '/', label: 'AEGIS', icon: <Shield className={ICON} /> },
  { kind: 'gap' },
  { kind: 'link', href: '/report', label: 'Report', icon: <Siren className={ICON} /> },
  { kind: 'link', href: '/control', label: 'Control', icon: <Radar className={ICON} /> },
  { kind: 'link', href: '/respond', label: 'Respond', icon: <Navigation className={ICON} /> },
  { kind: 'link', href: '/analytics', label: 'Analytics', icon: <Activity className={ICON} /> },
  { kind: 'gap' },
  { kind: 'link', href: '/beacon', label: 'Beacon', icon: <QrCode className={ICON} />, desktopOnly: true },
  { kind: 'link', href: '/case', label: 'Case', icon: <FileSearch className={ICON} />, desktopOnly: true },
  { kind: 'link', href: '/wanted', label: 'Wanted', icon: <Store className={ICON} />, desktopOnly: true },
  { kind: 'gap' },
  { kind: 'nexbot', href: '/ai', label: 'NEXBOT' },
  { kind: 'palette', label: 'Search · ⌘K' },
]

/** Asks the command palette to open. It listens globally for this. */
export const OPEN_PALETTE_EVENT = 'aegis:open-palette'

export function Dock() {
  const pathname = usePathname() ?? ''
  const reduceMotion = useReducedMotion()

  // Infinity = no cursor anywhere near the dock; every tile rests.
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY)

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <nav
      aria-label="AEGIS dock"
      className="print-hide pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center sm:bottom-5"
    >
      <motion.div
        onMouseMove={(event) => mouseX.set(event.clientX)}
        onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
        className="glass-chrome pointer-events-auto flex items-end gap-1 rounded-2xl px-2 pb-1.5 pt-1.5"
      >
        {ENTRIES.map((entry, index) => {
          if (entry.kind === 'gap') {
            return (
              <span
                key={`gap-${index}`}
                aria-hidden
                className="mx-0.5 mb-3 hidden h-6 w-px self-end bg-ops-border sm:block"
              />
            )
          }

          const magnify = reduceMotion ? null : mouseX

          if (entry.kind === 'palette') {
            return (
              <DockTile
                key="palette"
                label={entry.label}
                mouseX={magnify}
                onActivate={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
              >
                <Command className={ICON} />
              </DockTile>
            )
          }

          return (
            <DockTile
              key={entry.href}
              label={entry.label}
              href={entry.href}
              active={isActive(entry.href)}
              mouseX={magnify}
              desktopOnly={entry.kind === 'link' ? entry.desktopOnly : false}
            >
              {entry.kind === 'nexbot' ? <NexbotAvatar size={30} /> : entry.icon}
            </DockTile>
          )
        })}
      </motion.div>
    </nav>
  )
}

interface DockTileProps {
  label: string
  children: React.ReactNode
  href?: string
  active?: boolean
  desktopOnly?: boolean
  /** Null disables magnification (reduced motion). */
  mouseX: MotionValue<number> | null
  onActivate?: () => void
}

function DockTile({ label, children, href, active, desktopOnly, mouseX, onActivate }: DockTileProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)

  const restX = useMotionValue(Number.POSITIVE_INFINITY)
  const distance = useTransform(mouseX ?? restX, (x) => {
    const bounds = ref.current?.getBoundingClientRect()
    if (!bounds) return Number.POSITIVE_INFINITY
    return x - bounds.x - bounds.width / 2
  })

  const sizeTarget = useTransform(
    distance,
    [-MAGNIFY_RADIUS_PX, 0, MAGNIFY_RADIUS_PX],
    [TILE_REST_PX, TILE_PEAK_PX, TILE_REST_PX],
  )
  const size = useSpring(sizeTarget, { mass: 0.1, stiffness: 220, damping: 16 })
  const iconScale = useTransform(size, (value) => value / TILE_REST_PX)

  const tile = (
    <motion.div
      ref={ref}
      style={{ width: size, height: size }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative grid place-items-center rounded-xl transition-colors hover:bg-ops-lift/60"
    >
      <AnimatePresence>
        {hovered && (
          <motion.span
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="glass-chrome ops-label pointer-events-none absolute -top-9 whitespace-nowrap rounded-md px-2 py-1 text-ops-text"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>

      <motion.span style={{ scale: iconScale }} className="grid place-items-center">
        {children}
      </motion.span>

      {active && (
        <span className="absolute -bottom-1 size-1 rounded-full bg-ops-accent shadow-[0_0_6px_rgba(56,189,248,0.9)]" />
      )}
    </motion.div>
  )

  const visibility = desktopOnly ? 'hidden sm:block' : ''

  if (href) {
    return (
      <Link
        href={href}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={visibility}
      >
        {tile}
      </Link>
    )
  }

  return (
    <button type="button" aria-label={label} onClick={onActivate} className={visibility}>
      {tile}
    </button>
  )
}
