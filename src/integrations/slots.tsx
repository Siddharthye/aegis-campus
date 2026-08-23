import { INTEGRATIONS } from './integrations.config'
import { integrationsFor, widgetUrl, type IntegrationKind } from './registry'

/**
 * A named region of the UI that acquired modules drop into.
 *
 * Slots are placed and visible before we own anything to put in them, which is
 * the entire point: on the trading floor the integration work is choosing a
 * module, not building a mounting point for it.
 */

/** Height given to an embedded widget. Tall enough to be useful, not a page. */
const WIDGET_HEIGHT_PX = 320

interface IntegrationSlotProps {
  kind: IntegrationKind
  /** Shown above the slot, and in the placeholder when nothing is mounted. */
  label: string
  /**
   * Renders the placeholder when no integration is mounted. Off by default on
   * dense operational screens, on for the surfaces we demo.
   */
  showWhenEmpty?: boolean
}

/**
 * Renders every enabled integration registered for one slot kind.
 *
 * @example
 * <IntegrationSlot kind="analytics-panel" label="Acquired analytics" showWhenEmpty />
 */
export function IntegrationSlot({ kind, label, showWhenEmpty = false }: IntegrationSlotProps) {
  const mounted = integrationsFor(INTEGRATIONS, kind)

  if (mounted.length === 0) {
    if (!showWhenEmpty) return null
    return (
      <section className="rounded-lg border border-dashed border-ops-border bg-ops-panel/40 p-4">
        <p className="ops-label text-ops-faint">{label}</p>
        <p className="mt-1.5 text-[12px] text-ops-muted">
          Slot ready. Register an acquired module in{' '}
          <code className="font-mono text-ops-faint">src/integrations/integrations.config.ts</code>{' '}
          and it mounts here.
        </p>
      </section>
    )
  }

  return (
    <>
      {mounted.map((integration) => (
        <section
          key={integration.id}
          className="overflow-hidden rounded-lg border border-ops-border bg-ops-panel"
        >
          {/* Wraps rather than columns: in a narrow rail a long name beside a
              long licence string turns both into cramped two-line stacks. */}
          <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-ops-border px-3 py-2">
            <span className="ops-label text-ops-accent">{integration.name}</span>
            {integration.vendor && (
              <span className="ops-label ml-auto break-words text-ops-faint">
                {integration.vendor}
              </span>
            )}
          </header>

          {integration.mount === 'iframe' ? (
            <iframe
              src={widgetUrl(integration)}
              title={integration.name}
              height={WIDGET_HEIGHT_PX}
              className="w-full border-0 bg-ops-bg"
              loading="lazy"
            />
          ) : (
            <p className="px-3 py-2.5 text-[12px] text-ops-muted">
              Headless {integration.mount} integration — consumed through{' '}
              <code className="font-mono text-ops-faint">/api/ext</code>.
            </p>
          )}
        </section>
      ))}
    </>
  )
}
