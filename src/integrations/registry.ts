/**
 * The integration registry — how a module bought on the trading floor becomes
 * part of AEGIS.
 *
 * The 90-minute integration sprint is where most teams fail, so the slots are
 * pre-wired and empty: adding an acquired module is one entry in
 * `integrations.config.ts` and, for a remote seller, one env var. Nothing in
 * this file knows about any specific vendor.
 */

/**
 * Where an integration is allowed to appear. A kind is a promise about the
 * shape of the surface, so a module declared `analytics-panel` will be given a
 * card-sized region and nothing else.
 */
export type IntegrationKind =
  | 'alert-channel'
  | 'map-layer'
  | 'analytics-panel'
  | 'intake-channel'
  | 'media-pipeline'
  | 'custom'

/**
 * How the integration is rendered.
 *
 * - `iframe` — the seller ships a widget URL. Works with any stack, zero build.
 * - `rest` — headless; AEGIS calls it through `/api/ext` and renders the result.
 * - `react` — the seller ships a component we import directly.
 */
export type IntegrationMount = 'iframe' | 'rest' | 'react'

export interface Integration {
  id: string
  /** Shown in the slot header, so an assessor can see what came from where. */
  name: string
  kind: IntegrationKind
  mount: IntegrationMount
  /**
   * Origin of the module, e.g. `http://localhost:4101`. Requests are proxied
   * through `/api/ext?base=<src>` rather than called directly.
   */
  src: string
  /** Path appended to `src` for the embeddable view, for `iframe` mounts. */
  widgetPath?: string
  /** Who we acquired it from — printed in the slot, and used on pitch Slide 3. */
  vendor?: string
  enabled: boolean
}

/**
 * The URL an iframe-mounted integration renders, routed through our own proxy
 * so the browser never talks to the seller directly.
 *
 * @example
 * widgetUrl({ src: 'http://localhost:4102', widgetPath: '/widget', … })
 * // => '/api/ext/widget?base=http%3A%2F%2Flocalhost%3A4102'
 */
export function widgetUrl(integration: Integration): string {
  const path = (integration.widgetPath ?? '/widget').replace(/^\//, '')
  return `/api/ext/${path}?base=${encodeURIComponent(integration.src)}`
}

/**
 * The proxied URL for one API path on an integration — the `rest` mount's
 * equivalent of `widgetUrl`.
 *
 * @example
 * apiUrl(siren, 'api/alerts')
 * // => '/api/ext/api/alerts?base=http%3A%2F%2Flocalhost%3A4101'
 */
export function apiUrl(integration: Integration, path: string): string {
  return `/api/ext/${path.replace(/^\//, '')}?base=${encodeURIComponent(integration.src)}`
}

/**
 * Enabled integrations for one slot, in declaration order.
 *
 * @example
 * integrationsFor(INTEGRATIONS, 'analytics-panel').length // => 0 until we buy one
 */
export function integrationsFor(
  integrations: readonly Integration[],
  kind: IntegrationKind,
): Integration[] {
  return integrations.filter((integration) => integration.enabled && integration.kind === kind)
}
