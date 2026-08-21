/**
 * Origin allowlist for the `/api/ext` reverse proxy.
 *
 * The proxy forwards browser requests to modules acquired on the trading
 * floor, which kills CORS and hides ports. That makes it a server-side fetch
 * of an attacker-influenceable URL, so the destination is checked against an
 * allowlist rather than trusted — otherwise the endpoint would be a
 * server-side request forgery hole pointed at our own network.
 *
 * Pure functions only: no env reads here, so the rule is unit-testable and
 * the route decides what the allowlist actually contains.
 */

/** Ports our own modules run on locally: SIREN, ATLAS, FUSION. */
export const LOCAL_MODULE_PORTS = [4101, 4102, 4104] as const

/** Loopback hostnames that may host a locally-running module. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * Normalises an origin for comparison: scheme + host + port, no trailing
 * slash, no path. Returns null when the input is not a usable http(s) URL.
 *
 * @example
 * normaliseOrigin('http://localhost:4101/api/alerts') // => 'http://localhost:4101'
 * normaliseOrigin('ftp://example.com')                // => null
 */
export function normaliseOrigin(candidate: string): string | null {
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

/**
 * Whether the proxy may forward to this base URL.
 *
 * Locally-running module ports are always permitted so a fresh clone works
 * with no configuration; anything else must be listed explicitly in
 * `AEGIS_EXT_ALLOWLIST`.
 *
 * @example
 * isAllowedTarget('http://localhost:4101', [])                          // => true
 * isAllowedTarget('https://seller.vercel.app', ['https://seller.vercel.app']) // => true
 * isAllowedTarget('http://169.254.169.254', [])                         // => false
 */
export function isAllowedTarget(base: string, extraAllowlist: readonly string[]): boolean {
  const origin = normaliseOrigin(base)
  if (origin === null) return false

  const url = new URL(origin)
  const isLocalModule =
    LOOPBACK_HOSTS.has(url.hostname) &&
    (LOCAL_MODULE_PORTS as readonly number[]).includes(Number(url.port))
  if (isLocalModule) return true

  return extraAllowlist.some((entry) => normaliseOrigin(entry) === origin)
}

/**
 * Parses the comma-separated `AEGIS_EXT_ALLOWLIST` env value into origins,
 * discarding blanks and anything unparseable.
 *
 * @example
 * parseAllowlist('https://a.example, ,https://b.example')
 * // => ['https://a.example', 'https://b.example']
 */
export function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((entry) => normaliseOrigin(entry.trim()))
    .filter((origin): origin is string => origin !== null)
}
