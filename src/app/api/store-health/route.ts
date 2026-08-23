import { ok } from '@/lib/http'
import { store } from '@/store'
import { storeHealth } from '@/store/resilient'

export const dynamic = 'force-dynamic'

/**
 * `GET /api/store-health` — whether this instance still shares state.
 *
 * An instance that has fallen back to its own memory behaves normally from the
 * outside: reports are accepted, the board renders, nothing errors. But every
 * report it takes is invisible to every other instance, so the failure only
 * shows up as incidents that quietly do not exist. This is the one place that
 * says so out loud.
 */
export async function GET() {
  const adapters = storeHealth()
  const probe = await store
    .readCollection<unknown>('incidents')
    .then((items) => ({ readable: true, count: items.length, error: null }))
    .catch((error: unknown) => ({
      readable: false,
      count: 0,
      error: error instanceof Error ? error.message : String(error),
    }))

  return ok({
    sharingState: adapters.every((adapter) => !adapter.degraded),
    adapters,
    probe,
  })
}
