import { buildAnchors, listBuildings, type BeaconAnchor } from '@/domain/beacon'

/**
 * BEACON service — thin access to the deterministic anchor registry. There is
 * deliberately no store behind this: the registry is derived from campus data,
 * so it can never drift from the printed sheets.
 */

/**
 * Anchors for one building, or the whole campus registry when no filter is
 * given. Unknown building ids yield an empty list, never an error — the
 * report screen treats that as "no anchors nearby".
 *
 * @example
 * listAnchors('block-c').map((a) => a.id)
 * // => ['BLK-C-F1-A1', 'BLK-C-F1-A2', 'BLK-C-F2-A1', …]
 */
export function listAnchors(buildingId?: string): readonly BeaconAnchor[] {
  const anchors = buildAnchors()
  return buildingId ? anchors.filter((anchor) => anchor.buildingId === buildingId) : anchors
}

/**
 * Building ids that actually have anchors — drives filter chips on /beacon.
 *
 * @example
 * listAnchorBuildings()[0] // => { id: 'block-a', name: 'Block A' }
 */
export function listAnchorBuildings(): { id: string; name: string }[] {
  return listBuildings().map((building) => ({ id: building.id, name: building.shortName }))
}
