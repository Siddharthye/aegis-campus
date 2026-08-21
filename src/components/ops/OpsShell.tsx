import Link from 'next/link'
import { Nexbot } from '@/components/nexbot/Nexbot'
import { OpsNav } from './OpsNav'

interface OpsShellProps {
  title: string
  subtitle?: string
  /** Right-aligned header extras (live clocks, action buttons). */
  actions?: React.ReactNode
  children: React.ReactNode
}

/**
 * The chrome every ops screen shares: brand, seat tabs, live badge, NEXBOT.
 * Screens supply only their content — consistency comes free.
 */
export function OpsShell({ title, subtitle, actions, children }: OpsShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-ops-bg">
      <header className="sticky top-0 z-40 border-b border-ops-border bg-ops-deep/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="font-mono text-sm font-bold tracking-widest text-ops-text">AEGIS</span>
          </Link>

          <OpsNav />

          <span className="ml-auto hidden shrink-0 items-center gap-1.5 text-[10px] text-emerald-400 sm:flex">
            <span className="siren-pulse size-1.5 rounded-full bg-current" /> LIVE
          </span>
          {actions}
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
        <div className="mb-5">
          <h1 className="text-lg font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[12px] text-ops-muted">{subtitle}</p>}
        </div>
        {children}
      </div>

      <Nexbot />
    </div>
  )
}
