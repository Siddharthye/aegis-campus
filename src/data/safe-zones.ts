import { CAMPUS_CENTRE } from './campus'

/**
 * Muster points for evacuation.
 *
 * Hand-authored demo data, like the campus footprints — a real deployment
 * imports these from the institution's fire plan, because assembly points are
 * a regulatory artifact, not something software should invent. The shape is
 * what matters: open ground, a stated capacity, and a name a panicking
 * eighteen-year-old already recognises.
 */

export interface SafeZone {
  id: string
  name: string
  lat: number
  lng: number
  /** Roughly how many people the open ground holds. Drives overflow advice. */
  capacity: number
  /** Landmark phrasing for the broadcast: "behind the library", etc. */
  landmark: string
}

const M_PER_DEG_LAT = 111_320
const M_PER_DEG_LNG = 111_320 * Math.cos((CAMPUS_CENTRE.lat * Math.PI) / 180)

/** Places a zone by metre offsets from campus centre, as the footprints are. */
const zone = (
  id: string,
  name: string,
  northMetres: number,
  eastMetres: number,
  capacity: number,
  landmark: string,
): SafeZone => ({
  id,
  name,
  lat: CAMPUS_CENTRE.lat + northMetres / M_PER_DEG_LAT,
  lng: CAMPUS_CENTRE.lng + eastMetres / M_PER_DEG_LNG,
  capacity,
  landmark,
})

/**
 * The campus muster points, spread deliberately so that no single incident
 * can compromise every option — an assembly plan whose points all sit on one
 * side of campus is not an assembly plan.
 */
export const SAFE_ZONES: readonly SafeZone[] = [
  zone('sports-field', 'Sports Field', -300, 200, 2000, 'the open field beside the Sports Pavilion'),
  zone('main-ground', 'Main Ground', 60, 190, 1500, 'the open ground east of the Library'),
  zone('gate-3-muster', 'Gate 3 Muster Point', 250, 110, 600, 'the paved area inside Gate 3'),
  zone('north-lawn', 'North Lawn', 190, -240, 800, 'the lawn north of Block A'),
  zone('hostel-quad', 'Hostel Quadrangle', -260, -60, 1000, 'the quad between Hostels 7 and 8'),
]
