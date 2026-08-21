/**
 * Campus 25 — KIIT School of Computer Science and Engineering, Patia.
 *
 * Traced from the published campus maps: the block cluster sits north of the
 * IT Park approach, with the lake and Ram Setu off the north-west corner and
 * the iON Digital Zone / Odisha Television frontage to the south. Coordinates
 * are real WGS84, so a GPS fix from a phone standing on campus lands inside
 * the boundary rather than on an invented grid.
 *
 * Safe Walk renders this: routes, gates and muster points have to be places a
 * student actually recognises, or the guidance is theatre.
 */

export interface Point {
  lat: number
  lng: number
}

/** The academic block cluster, roughly the centroid of the built area. */
export const CAMPUS25_CENTRE: Point = { lat: 20.3549, lng: 85.8197 }

/** Campus perimeter, clockwise from the north-west corner by the lake. */
export const CAMPUS25_BOUNDARY: readonly Point[] = [
  { lat: 20.3572, lng: 85.8168 },
  { lat: 20.3576, lng: 85.8215 },
  { lat: 20.3558, lng: 85.8238 },
  { lat: 20.3531, lng: 85.8236 },
  { lat: 20.3521, lng: 85.8208 },
  { lat: 20.3529, lng: 85.8175 },
]

export type BlockKind = 'academic' | 'admin' | 'amenity' | 'hostel' | 'utility'

export interface CampusBlock {
  id: string
  name: string
  kind: BlockKind
  /** Footprint corners, clockwise. */
  footprint: readonly Point[]
  /** Which floors of this block have a digitised plan. */
  surveyedFloors?: readonly number[]
}

/** Rectangle helper — campus blocks are near-rectangular in the plan. */
function block(
  id: string,
  name: string,
  kind: BlockKind,
  north: number,
  east: number,
  height: number,
  width: number,
  surveyedFloors?: readonly number[],
): CampusBlock {
  const mPerLat = 1 / 111_320
  const mPerLng = 1 / (111_320 * Math.cos((CAMPUS25_CENTRE.lat * Math.PI) / 180))
  const lat = CAMPUS25_CENTRE.lat + north * mPerLat
  const lng = CAMPUS25_CENTRE.lng + east * mPerLng
  const dLat = (height / 2) * mPerLat
  const dLng = (width / 2) * mPerLng

  return {
    id,
    name,
    kind,
    footprint: [
      { lat: lat + dLat, lng: lng - dLng },
      { lat: lat + dLat, lng: lng + dLng },
      { lat: lat - dLat, lng: lng + dLng },
      { lat: lat - dLat, lng: lng - dLng },
    ],
    ...(surveyedFloors ? { surveyedFloors } : {}),
  }
}

/**
 * The blocks students name. A, B and C match the wings on the second-floor
 * plan; the rest are the buildings that ring them.
 */
export const CAMPUS25_BLOCKS: readonly CampusBlock[] = [
  block('block-a', 'A Block', 'academic', -60, -40, 70, 130, [2]),
  block('block-b', 'B Block', 'academic', 70, -30, 80, 140, [2]),
  block('block-c', 'C Block', 'academic', 0, 90, 120, 70, [2]),
  block('admin', 'Administration', 'admin', 40, -160, 60, 70),
  block('library', 'Central Library', 'amenity', 90, 110, 60, 70),
  block('canteen', 'Food Court', 'amenity', -110, 70, 45, 60),
  block('audi', 'Auditorium', 'amenity', 130, 30, 55, 80),
  block('workshop', 'Workshop & Labs', 'utility', -130, -110, 50, 90),
  block('parking', 'Parking Bay', 'utility', -150, 40, 40, 120),
]

export interface CampusGate {
  id: string
  name: string
  /** Where it leads, as a student would say it. */
  towards: string
  position: Point
}

/** Entry points. The main gate is the one signposted near KP 25. */
export const CAMPUS25_GATES: readonly CampusGate[] = [
  { id: 'main', name: 'Main Gate', towards: 'KP 25 / IT Park Road', position: { lat: 20.3528, lng: 85.8190 } },
  { id: 'north', name: 'North Gate', towards: 'Ram Setu / Lake side', position: { lat: 20.3571, lng: 85.8186 } },
  { id: 'east', name: 'East Gate', towards: 'Odisha Television Road', position: { lat: 20.3546, lng: 85.8232 } },
]

export interface Landmark {
  id: string
  name: string
  position: Point
  /** Landmarks outside the perimeter still orient people. */
  offCampus?: boolean
}

/** What a student uses to orient themselves, on and off campus. */
export const CAMPUS25_LANDMARKS: readonly Landmark[] = [
  { id: 'kp25', name: 'KP-25 (ABCD)', position: { lat: 20.3529, lng: 85.8158 }, offCampus: true },
  { id: 'idz', name: 'iON Digital Zone', position: { lat: 20.3512, lng: 85.8172 }, offCampus: true },
  { id: 'otv-rd', name: 'Odisha Television Rd', position: { lat: 20.3512, lng: 85.8226 }, offCampus: true },
  { id: 'it-park', name: 'IT Park Rd', position: { lat: 20.3524, lng: 85.8184 }, offCampus: true },
]

/** Water and open ground, drawn as context rather than obstacles. */
export interface Terrain {
  id: string
  name: string
  kind: 'water' | 'field'
  outline: readonly Point[]
}

/**
 * Narendra Pond dominates the north-west approach: it is the single most
 * useful orientation cue on this campus, and the reason the west side has no
 * through route. The archery field sits beyond its northern shore.
 */
export const CAMPUS25_TERRAIN: readonly Terrain[] = [
  {
    id: 'narendra-pond',
    name: 'Narendra Pond',
    kind: 'water',
    outline: [
      { lat: 20.3588, lng: 85.8138 },
      { lat: 20.3590, lng: 85.8168 },
      { lat: 20.3570, lng: 85.8178 },
      { lat: 20.3552, lng: 85.8170 },
      { lat: 20.3548, lng: 85.8148 },
      { lat: 20.3566, lng: 85.8134 },
    ],
  },
  {
    id: 'archery-field',
    name: 'KIIT-KISS Archery Field',
    kind: 'field',
    outline: [
      { lat: 20.3600, lng: 85.8150 },
      { lat: 20.3602, lng: 85.8168 },
      { lat: 20.3590, lng: 85.8170 },
      { lat: 20.3588, lng: 85.8152 },
    ],
  },
]

/** The ring road that wraps the campus and carries every vehicle approach. */
export const CAMPUS25_RING_ROAD: readonly Point[] = [
  { lat: 20.3527, lng: 85.8186 },
  { lat: 20.3540, lng: 85.8174 },
  { lat: 20.3558, lng: 85.8172 },
  { lat: 20.3573, lng: 85.8182 },
  { lat: 20.3578, lng: 85.8206 },
  { lat: 20.3566, lng: 85.8231 },
  { lat: 20.3543, lng: 85.8238 },
  { lat: 20.3527, lng: 85.8222 },
  { lat: 20.3523, lng: 85.8200 },
  { lat: 20.3527, lng: 85.8186 },
]

/**
 * Lit, patrolled walking routes between the gates and the block cluster.
 * Safe Walk prefers these — the shortest line across a dark service yard is
 * not the safest one, and the difference is the entire point of the feature.
 */
export interface WalkRoute {
  id: string
  name: string
  path: readonly Point[]
  /** Lit and covered by patrol, as recorded by campus security. */
  lit: boolean
}

export const CAMPUS25_ROUTES: readonly WalkRoute[] = [
  {
    id: 'main-spine',
    name: 'Main Gate → Academic spine',
    lit: true,
    path: [
      { lat: 20.3528, lng: 85.8190 },
      { lat: 20.3538, lng: 85.8193 },
      { lat: 20.3549, lng: 85.8197 },
      { lat: 20.3560, lng: 85.8199 },
    ],
  },
  {
    id: 'east-link',
    name: 'C Block → East Gate',
    lit: true,
    path: [
      { lat: 20.3549, lng: 85.8207 },
      { lat: 20.3548, lng: 85.8220 },
      { lat: 20.3546, lng: 85.8232 },
    ],
  },
  {
    id: 'north-link',
    name: 'B Block → North Gate',
    lit: false,
    path: [
      { lat: 20.3556, lng: 85.8194 },
      { lat: 20.3564, lng: 85.8189 },
      { lat: 20.3571, lng: 85.8186 },
    ],
  },
]

/**
 * Assembly points for evacuation, on real open ground: the parking bay, the
 * lawn by the auditorium, and the paved area inside the main gate.
 */
export interface Muster {
  id: string
  name: string
  position: Point
  capacity: number
  landmark: string
}

export const CAMPUS25_MUSTERS: readonly Muster[] = [
  {
    id: 'parking-bay',
    name: 'Parking Bay',
    position: { lat: 20.3535, lng: 85.8201 },
    capacity: 1200,
    landmark: 'the open parking south of the blocks',
  },
  {
    id: 'audi-lawn',
    name: 'Auditorium Lawn',
    position: { lat: 20.3562, lng: 85.8200 },
    capacity: 900,
    landmark: 'the lawn in front of the Auditorium',
  },
  {
    id: 'gate-forecourt',
    name: 'Main Gate Forecourt',
    position: { lat: 20.3530, lng: 85.8191 },
    capacity: 600,
    landmark: 'the paved forecourt inside the Main Gate',
  },
]
