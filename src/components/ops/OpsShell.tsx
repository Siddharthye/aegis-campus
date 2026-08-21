
import { LiveClock } from '@/components/ui/LiveClock'

interface OpsShellProps {
  title: string
  subtitle?: string
  /** Right-aligned header extras (live clocks, action buttons). */
  actions?: React.ReactNode
  /** Small stat chips rendered beside the title — cheap density, no cards. */
  meta?: React.ReactNode
  /**
   * Full-bleed stage (NEXBOT console): no padded content column, no page
   * title block — the child owns the viewport under the dock.
   */
  immersive?: boolean
  /** Wider than the default column, for map- and console-heavy screens. */
  wide?: boolean
  children: React.ReactNode
}

/**
 * The chrome every ops screen shares.
 *
 * There is deliberately no top navigation bar: the dock is the navigation, and
 * a second persistent bar above the content only stole vertical space from the
 * screens that need it most. What remains is an inline title row that scrolls
 * away with the page.
 */
export function OpsShell({
  title,
  subtitle,
  actions,
  meta,
  immersive = false,
  wide = false,
  children,
}: OpsShellProps) {
  if (immersive) {
    return (
      <div className="relative min-h-screen bg-ops-bg">
        {children}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-ops-bg">
      <div
        className={`mx-auto w-full flex-1 px-4 pb-36 pt-6 sm:px-6 ${wide ? 'max-w-[1600px]' : 'max-w-7xl'}`}
      >
        <header className="mb-5 flex flex-wrap items-end gap-x-5 gap-y-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{title}</h1>
              <span className="ops-label flex shrink-0 items-center gap-1.5 text-emerald-400">
                <span className="siren-pulse size-1.5 rounded-full bg-current" /> LIVE
              </span>
            </div>
            {subtitle && (
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ops-muted">{subtitle}</p>
            )}
          </div>

          {meta && <div className="flex flex-wrap items-center gap-2">{meta}</div>}

          {/* One clock for the whole site, read from the reader's device. */}
          <div className="ml-auto flex items-center gap-2">
            {actions}
            <LiveClock />
          </div>
        </header>

        {children}
      </div>

    </div>
  )
}
