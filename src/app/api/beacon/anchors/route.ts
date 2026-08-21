import { ok } from '@/lib/http'
import { listAnchors } from '@/lib/beacon-service'

export const dynamic = 'force-dynamic'

/**
 * `GET /api/beacon/anchors?buildingId=block-c`
 *
 * The BEACON anchor registry — every printable QR anchor on campus, optionally
 * filtered to one building. Deterministic: derived from campus footprints, so
 * the same ids appear here, on the printed sheets, and in QR deep links.
 *
 * @example
 * const { anchors } = await fetch('/api/beacon/anchors?buildingId=block-c').then((r) => r.json())
 * anchors[0].id // => "BLK-C-F1-A1"
 */
export async function GET(request: Request) {
  const buildingId = new URL(request.url).searchParams.get('buildingId') ?? undefined
  const anchors = listAnchors(buildingId)
  return ok({ anchors, count: anchors.length })
}
