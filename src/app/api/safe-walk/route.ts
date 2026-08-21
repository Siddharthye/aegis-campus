import { z } from 'zod'
import {
  checkInSafeWalk,
  endSafeWalk,
  listSafeWalks,
  startSafeWalk,
} from '@/lib/safe-walk-service'
import { fail, ok, parseBody } from '@/lib/http'

export const dynamic = 'force-dynamic'

const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

const startSchema = z.object({
  action: z.literal('start'),
  destination: z.string().min(1).max(120),
  expectedMinutes: z.number().int().min(1).max(120),
  origin: coordinatesSchema,
  trustedContacts: z.array(z.string().min(1).max(80)).max(5).default([]),
})

const updateSchema = z.object({
  action: z.enum(['checkin', 'arrived', 'cancelled']),
  walkId: z.string().min(1).max(60),
  position: coordinatesSchema.optional(),
})

const requestSchema = z.discriminatedUnion('action', [startSchema, updateSchema])

/**
 * `GET /api/safe-walk`
 *
 * Every safe walk. Reading this is also what *evaluates* overdue state: a
 * walker who has gone silent escalates to a silent alarm here rather than on a
 * timer, because timers do not survive serverless. The control room polls it.
 */
export async function GET() {
  const walks = await listSafeWalks()
  return ok({ walks, count: walks.length })
}

/**
 * `POST /api/safe-walk`
 *
 * One endpoint for the whole lifecycle, discriminated on `action`:
 * `start`, `checkin`, `arrived`, `cancelled`.
 *
 * @example
 * await fetch('/api/safe-walk', {
 *   method: 'POST',
 *   body: JSON.stringify({ action: 'start', destination: 'Hostel 8', expectedMinutes: 12, origin }),
 * })
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, requestSchema)
  if (!parsed.success) return parsed.response

  if (parsed.data.action === 'start') {
    const { destination, expectedMinutes, origin, trustedContacts } = parsed.data
    return ok({ walk: await startSafeWalk({ destination, expectedMinutes, origin, trustedContacts }) }, 201)
  }

  const { action, walkId, position } = parsed.data
  const walk =
    action === 'checkin'
      ? await checkInSafeWalk(walkId, position)
      : await endSafeWalk(walkId, action)

  if (!walk) return fail('No active walk with that id', 404)
  return ok({ walk })
}
