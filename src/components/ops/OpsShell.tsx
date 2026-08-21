import Link from 'next/link'
import { Nexbot } from '@/components/nexbot/Nexbot'

interface OpsShellProps {
  title: string
  subtitle?: string
  /** Right-aligned header extras (live clocks, action buttons). */
  actions?: React.ReactNode
  children: React.ReactNode
}

/**
 * The chrome every ops screen shares: a slim glass header and NEXBOT.
 * Navigation lives in the dock, mounted globally — so the header carries
 * identity and status, nothing else. Bottom padding keeps content clear of
 * the dock.
 */
export function OpsShell({ title, subtitle, actions, children }: OpsShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-ops-bg">
      <header className="sticky top-0 z-40 border-b border-ops-border/70 bg-ops-deep/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="font-mono text-sm font-bold tracking-widest text-ops-text">AEGIS</span>
          </Link>

          <span className="hidden h-4 w-px bg-ops-border sm:block" />
          <span className="ops-label hidden text-ops-faint sm:block">{title}</span>

          <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[10px] text-emerald-400">
            <span className="siren-pulse size-1.5 rounded-full bg-current" /> LIVE
          </span>
          {actions}
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 pb-32 pt-5">
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
