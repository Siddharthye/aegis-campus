/**
 * Campus 25, Second Floor — the real published layout.
 *
 * Transcribed from the KIIT SAATHI floorwise plan: three wings meeting at a
 * spine, A and B block room runs, the C-block academic offices, and the
 * lecture theatres in the south-east. Coordinates are in an abstract plan
 * space (0–100 on each axis) so the renderer can project them however it
 * likes without re-measuring anything.
 *
 * This is the dataset the report screen's 3D floor renders, so a reporter
 * points at the room they are actually standing in rather than a generic pin.
 */

export type SpaceKind =
  | 'room'
  | 'lecture'
  | 'office'
  | 'lift'
  | 'stairs'
  | 'washroom'
  | 'amenity'
  | 'corridor'

export interface FloorSpace {
  id: string
  label: string
  kind: SpaceKind
  /** Plan-space rectangle, 0–100 on both axes. */
  x: number
  y: number
  w: number
  h: number
  /** Wing this space belongs to — drives grouping and filters. */
  wing: 'A' | 'B' | 'C'
  /** Extra line shown on hover, where the plan names one. */
  note?: string
  /**
   * Floors this space exists on. Omitted means every floor — used for the
   * library approach, which only opens off the upper corridor.
   */
  onlyFloors?: readonly number[]
}

/** Corridors are drawn beneath everything as the circulation spine. */
export interface FloorCorridor {
  id: string
  x: number
  y: number
  w: number
  h: number
}

const room = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  wing: FloorSpace['wing'],
  kind: SpaceKind = 'room',
  note?: string,
): FloorSpace => ({ id, label: id, kind, x, y, w, h, wing, ...(note ? { note } : {}) })

/** The circulation spine: the corridors every wing hangs off. */
export const FLOOR_CORRIDORS: readonly FloorCorridor[] = [
  { id: 'spine-b', x: 34, y: 30, w: 32, h: 2.4 },
  { id: 'spine-mid', x: 8, y: 46, w: 74, h: 2.4 },
  { id: 'spine-a', x: 8, y: 66, w: 58, h: 2.4 },
  { id: 'riser-b-left', x: 34, y: 8, w: 2.4, h: 24 },
  { id: 'riser-b-right', x: 63, y: 8, w: 2.4, h: 24 },
  { id: 'riser-c', x: 63, y: 32, w: 2.4, h: 36 },
  { id: 'riser-a', x: 46, y: 48, w: 2.4, h: 40 },
  { id: 'riser-lt', x: 72, y: 56, w: 2.4, h: 28 },
]

/**
 * Every named space on the floor. Room numbers follow the plan exactly —
 * B-series in the north wing, A-series in the south, C-series in the east.
 */
export const FLOOR_SPACES: readonly FloorSpace[] = [
  // ── B wing (north block) ────────────────────────────────────────────────
  room('B 201', 66, 8, 9, 6, 'B'),
  room('B 202', 56, 8, 6, 6, 'B'),
  room('B 203', 48, 14, 7, 6, 'B'),
  room('B 204', 48, 8, 7, 6, 'B'),
  room('B 205', 40, 8, 7, 6, 'B'),
  room('B 206', 24, 14, 9, 6, 'B'),
  room('B 207', 24, 21, 9, 6, 'B'),
  room('B 208', 34, 21, 8, 6, 'B'),
  room('B 209', 24, 28, 9, 6, 'B'),
  room('B 210', 34, 28, 8, 6, 'B'),
  room('B 218', 56, 28, 7, 6, 'B'),
  room('B 219', 66, 28, 8, 5, 'B'),
  room('B 220', 66, 23, 8, 5, 'B'),
  room('B 221', 56, 21, 7, 6, 'B'),
  room('B 222', 66, 18, 8, 5, 'B'),
  room('Lift 7', 63, 16, 4, 4, 'B', 'lift'),
  room('Lift 8', 58, 8, 4, 5, 'B', 'lift'),
  room('Lift 9', 40, 8, 4, 5, 'B', 'lift'),
  room('Lift 10', 33, 14, 4, 4, 'B', 'lift'),
  room('Stairs B-W', 36, 8, 4, 4, 'B', 'stairs'),
  room('Stairs B-E', 68, 8, 5, 4, 'B', 'stairs'),
  room('WC Gents B', 24, 6, 8, 5, 'B', 'washroom', 'North-west corner'),
  room('WC Ladies B', 60, 2, 9, 4, 'B', 'washroom', 'North spur'),
  room('Water B', 45, 14, 4, 4, 'B', 'amenity', 'Water cooler'),

  // ── B wing lower run (meets the mid spine) ──────────────────────────────
  room('B 211', 10, 34, 8, 5, 'B'),
  room('B 212', 10, 40, 8, 5, 'B'),
  room('B 213', 20, 40, 8, 5, 'B'),
  room('B 214', 10, 46, 8, 0, 'B'),
  room('B 215', 20, 46, 8, 5, 'B'),
  room('B 216', 36, 34, 7, 5, 'B'),
  room('B 217', 45, 34, 7, 5, 'B'),
  room('Lift 11', 28, 34, 4, 4, 'B', 'lift'),
  room('Lift 12', 18, 34, 4, 4, 'B', 'lift'),
  room('WC Ladies B2', 4, 30, 9, 5, 'B', 'washroom'),

  // ── C wing (east: faculty, society, library approach) ───────────────────
  room('C 201', 48, 38, 18, 6, 'C', 'office', 'Faculty Chambers'),
  room('C 203', 76, 46, 20, 8, 'C', 'office', 'Society Office · MI&CV, Cyber Vault, QA Cell'),
  room('C 211', 76, 62, 11, 6, 'C', 'lecture', 'Lecture Theatre 4'),
  room('C 213', 63, 62, 11, 6, 'C', 'lecture', 'Lecture Theatre 6'),
  room('C 212 W', 63, 74, 11, 7, 'C', 'lecture', 'Lecture Theatre 5'),
  room('C 212 E', 78, 74, 11, 7, 'C', 'lecture', 'Lecture Theatre 5'),
  { ...room('Library', 84, 38, 12, 6, 'C', 'amenity', 'Towards the Library'), onlyFloors: [3] },
  room('Lift 15', 76, 32, 4, 4, 'C', 'lift'),
  room('Lift 16', 76, 37, 4, 4, 'C', 'lift'),
  room('Lift 18', 66, 46, 4, 4, 'C', 'lift'),
  room('Lift 19', 66, 52, 4, 4, 'C', 'lift'),
  room('Lift 20', 66, 58, 4, 4, 'C', 'lift'),
  room('Stairs C', 76, 42, 5, 4, 'C', 'stairs'),
  room('Water C', 70, 46, 4, 4, 'C', 'amenity', 'Water cooler'),
  room('Seating', 70, 82, 8, 5, 'C', 'amenity', 'Seating area'),
  room('WC Gents C', 61, 70, 8, 4, 'C', 'washroom'),
  room('WC Ladies C', 80, 70, 9, 4, 'C', 'washroom'),

  // ── A wing (south block) ────────────────────────────────────────────────
  room('A 201', 40, 82, 6, 5, 'A'),
  room('A 202', 33, 82, 6, 5, 'A'),
  room('A 203', 25, 82, 7, 5, 'A'),
  room('A 204', 17, 82, 7, 5, 'A'),
  room('A 205', 9, 82, 7, 5, 'A'),
  room('A 206', 4, 74, 7, 6, 'A'),
  room('A 207', 4, 62, 7, 5, 'A'),
  room('A 208', 12, 62, 7, 5, 'A'),
  room('A 209', 4, 56, 7, 5, 'A'),
  room('A 210', 12, 56, 7, 5, 'A'),
  room('A 211', 8, 50, 5, 4, 'A'),
  room('A 212', 14, 52, 6, 4, 'A'),
  room('A 213', 14, 47, 6, 4, 'A'),
  room('A 214', 34, 50, 6, 4, 'A'),
  room('A 215', 41, 50, 6, 4, 'A'),
  room('A 216', 52, 62, 7, 4, 'A'),
  room('A 217', 41, 68, 7, 4, 'A'),
  room('A 218', 52, 68, 7, 4, 'A'),
  room('Lift 1', 41, 76, 4, 4, 'A', 'lift'),
  room('Lift 2', 34, 82, 4, 4, 'A', 'lift'),
  room('Lift 3', 17, 82, 4, 4, 'A', 'lift'),
  room('Lift 4', 4, 68, 4, 4, 'A', 'lift'),
  room('Lift 6', 28, 50, 4, 4, 'A', 'lift'),
  room('Stairs A-W', 12, 76, 5, 4, 'A', 'stairs'),
  room('Stairs A-E', 50, 82, 5, 4, 'A', 'stairs'),
  room('Staff WC', 41, 62, 7, 4, 'A', 'washroom', 'Staff toilet'),
  room('WC Ladies A', 4, 88, 9, 4, 'A', 'washroom'),
  room('WC Ladies A2', 52, 74, 9, 4, 'A', 'washroom'),
  room('WC Gents A', 2, 50, 7, 4, 'A', 'washroom'),
  room('Water A', 14, 57, 4, 3, 'A', 'amenity', 'Water cooler'),
]

/** Wings, for the filter rail and the legend. */
export const FLOOR_WINGS = [
  { id: 'A' as const, label: 'A Block', hint: 'South wing · A 201–218' },
  { id: 'B' as const, label: 'B Block', hint: 'North wing · B 201–222' },
  { id: 'C' as const, label: 'C Block', hint: 'East wing · faculty, society, theatres' },
]

/**
 * The floors AEGIS can render.
 *
 * Campus 25 stacks: floors 1–3 share one structural grid, so the wings, lifts,
 * stairs and corridors sit in the same places and only the room numbers change
 * — B 201 on the second floor is B 101 directly below it. Floor 2 is the one
 * transcribed from the published plan; 1 and 3 are derived from it by
 * renumbering, which is honest for navigation and is labelled as derived.
 */
export const CAMPUS_FLOORS = [
  { id: 1, label: 'First Floor', surveyed: false },
  { id: 2, label: 'Second Floor', surveyed: true },
  { id: 3, label: 'Third Floor', surveyed: false },
] as const

export type FloorId = (typeof CAMPUS_FLOORS)[number]['id']

/**
 * Renumbers a floor-2 room id onto another floor: `B 201` → `B 101`.
 *
 * Only the hundreds digit moves. Anything without a floor-2 room number —
 * lifts, stairs, washrooms, the named offices — keeps its label, because a
 * stairwell is the same stairwell on every floor.
 */
function renumber(id: string, floor: FloorId): string {
  return id.replace(/\b([ABC]) 2(\d{2})\b/, (_match, wing: string, room: string) => `${wing} ${floor}${room}`)
}

/**
 * The spaces on one floor. Floor 2 is the transcribed plan; the others reuse
 * its geometry with renumbered rooms.
 *
 * @example
 * spacesForFloor(1).find((space) => space.id === 'B 101') // => the room below B 201
 */
export function spacesForFloor(floor: FloorId): FloorSpace[] {
  const present = FLOOR_SPACES.filter(
    (space) => space.onlyFloors === undefined || space.onlyFloors.includes(floor),
  )
  if (floor === 2) return present

  return present.map((space) => {
    const id = renumber(space.id, floor)
    return { ...space, id, label: id }
  })
}

/**
 * Named offices only exist where the published plan puts them, so a derived
 * floor should not claim to hold the Society Office.
 *
 * @example
 * noteForFloor('Faculty Chambers', 3) // => undefined
 */
export function noteForFloor(note: string | undefined, floor: FloorId): string | undefined {
  return floor === 2 ? note : undefined
}

/**
 * Looks up a space by its printed room number.
 *
 * @example
 * findSpace('C 203')?.note // => 'Society Office · MI&CV, Cyber Vault, QA Cell'
 */
export function findSpace(id: string): FloorSpace | null {
  return FLOOR_SPACES.find((space) => space.id === id) ?? null
}
