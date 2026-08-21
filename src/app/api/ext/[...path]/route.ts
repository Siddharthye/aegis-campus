import { isAllowedTarget, parseAllowlist } from '@/domain/ext-allowlist'
import { fail } from '@/lib/http'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ path: string[] }> }

/** Hop-by-hop and identity headers that must not be replayed upstream. */
const STRIPPED_REQUEST_HEADERS = new Set(['host', 'connection', 'cookie', 'content-length'])

/**
 * Reverse-proxies one request to an acquired module.
 *
 * `/api/ext/api/alerts?base=http://localhost:4101` forwards to
 * `http://localhost:4101/api/alerts`. This is what makes integrating a module
 * bought on the trading floor one config entry instead of an afternoon: the
 * browser only ever talks to our own origin, so there is no CORS to negotiate,
 * no port to expose, and a seller can be swapped for another by changing
 * `base`.
 *
 * The destination is checked against the allowlist on every request — see
 * `domain/ext-allowlist.ts` for why.
 */
async function proxy(request: Request, { params }: RouteContext): Promise<Response> {
  const { path } = await params
  const requestUrl = new URL(request.url)
  const base = requestUrl.searchParams.get('base')
  if (!base) return fail('Missing ?base= target', 400)

  if (!isAllowedTarget(base, parseAllowlist(process.env.AEGIS_EXT_ALLOWLIST))) {
    return fail(
      'Target origin is not allowlisted. Add it to AEGIS_EXT_ALLOWLIST.',
      403,
      { base },
    )
  }

  const target = new URL(path.join('/'), base.endsWith('/') ? base : `${base}/`)
  for (const [key, value] of requestUrl.searchParams) {
    if (key !== 'base') target.searchParams.append(key, value)
  }

  const headers = new Headers()
  for (const [key, value] of request.headers) {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value)
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
      // Modules stream SSE, so the response must not be buffered.
      cache: 'no-store',
      redirect: 'manual',
    })

    const responseHeaders = new Headers(upstream.headers)
    responseHeaders.delete('content-encoding')
    responseHeaders.delete('content-length')

    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
  } catch (error) {
    // A seller module that is down must degrade to a readable error, never a
    // stack trace — during the integration sprint this message is the only
    // debugging anyone has time for.
    return fail('Upstream module unreachable', 502, {
      target: target.origin,
      cause: error instanceof Error ? error.message : String(error),
    })
  }
}

export const GET = proxy
export const POST = proxy
export const PATCH = proxy
export const PUT = proxy
export const DELETE = proxy
