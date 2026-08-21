'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * The ops taskbar.
 *
 * Split in two on purpose. **Seats** are where a person works — one per role,
 * and the one you are in is the answer to "who am I right now". **Tools** are
 * things you open, use, and leave. Mixing them makes a seven-item tab bar in
 * which nothing is primary.
 *
 * The active tab is derived from the URL rather than passed in, so a screen
 * can never mislabel itself — which two of them previously did.
 */

const SEATS = [
  { href: '/report', label: 'Report' },
  { href: '/control', label: 'Control' },
  { href: '/respond', label: 'Respond' },
  { href: '/analytics', label: 'Analytics' },
] as const

const TOOLS = [
  { href: '/beacon', label: 'Beacon', title: 'Printable QR anchor sheets' },
  { href: '/case', label: 'Case', title: 'Check a case with a VEIL token' },
  { href: '/wanted', label: 'Wanted', title: 'Integrations we will buy' },
] as const

/** `/drill/x/brief` should still light up nothing; only exact sections match. */
const isActive = (pathname: string, href: string): boolean =>
  pathname === href || pathname.startsWith(`${href}/`)

export function OpsNav() {
  const pathname = usePathname() ?? ''

  return (
    <nav
      aria-label="AEGIS sections"
      className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {SEATS.map((seat) => (
        <Link
          key={seat.href}
          href={seat.href}
          aria-current={isActive(pathname, seat.href) ? 'page' : undefined}
          className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
            isActive(pathname, seat.href)
              ? 'bg-ops-accent/15 text-ops-accent'
              : 'text-ops-muted hover:bg-ops-panel hover:text-ops-text'
          }`}
        >
          {seat.label}
        </Link>
      ))}

      <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-ops-border" />

      {TOOLS.map((tool) => (
        <Link
          key={tool.href}
          href={tool.href}
          title={tool.title}
          aria-current={isActive(pathname, tool.href) ? 'page' : undefined}
          className={`shrink-0 rounded-full px-2.5 py-1.5 text-[12px] transition-colors ${
            isActive(pathname, tool.href)
              ? 'bg-ops-accent/15 text-ops-accent'
              : 'text-ops-faint hover:bg-ops-panel hover:text-ops-muted'
          }`}
        >
          {tool.label}
        </Link>
      ))}
    </nav>
  )
}
