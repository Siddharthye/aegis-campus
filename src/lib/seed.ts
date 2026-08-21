import type { Incident, Responder } from '@/domain/types'
import { CAMPUS_CENTRE } from '@/data/campus'

/** Roughly 100 metres in decimal degrees at this latitude. */
const HM = 0.0009

const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString()

/**
 * Demo responders positioned around campus — one of each unit plus spares, so
 * dispatch recommendations always have someone sensible to offer.
 */
export const seedResponders: Responder[] = [
  { id: 'resp-sec-1', name: 'A. Pradhan', unit: 'security', offLat: 2.1, offLng: 1.4 },
  { id: 'resp-sec-2', name: 'R. Mishra', unit: 'security', offLat: -1.8, offLng: -1.2 },
  { id: 'resp-med-1', name: 'Dr. S. Nayak', unit: 'medical', offLat: 1.5, offLng: -0.6 },
  { id: 'resp-med-2', name: 'N. Behera', unit: 'medical', offLat: 1.4, offLng: -0.7 },
  { id: 'resp-fire-1', name: 'K. Das', unit: 'fire', offLat: -1.1, offLng: 2.0 },
  { id: 'resp-mnt-1', name: 'P. Sahoo', unit: 'maintenance', offLat: -1.0, offLng: 1.9 },
].map(({ id, name, unit, offLat, offLng }) => ({
  id,
  name,
  unit: unit as Responder['unit'],
  status: 'available' as const,
  location: { lat: CAMPUS_CENTRE.lat + offLat * HM, lng: CAMPUS_CENTRE.lng + offLng * HM },
  incidentId: null,
}))

/**
 * A small believable history: one active medical case, one dispatched water
 * leak, two resolved incidents for the analytics screens. Every screen has
 * something real to show on first load.
 */
export const seedIncidents: Incident[] = [
  {
    id: 'inc-seed-1',
    category: 'medical',
    severity: 'P1',
    status: 'triaged',
    title: 'Student collapsed near Central Library',
    description: 'Student feeling faint and collapsed by the library entrance. Conscious, breathing.',
    location: {
      lat: CAMPUS_CENTRE.lat + 0.4 * HM,
      lng: CAMPUS_CENTRE.lng + 0.6 * HM,
      label: 'Central Library · Main entrance',
      method: 'floor-plan',
      confidence: 0.99,
      floor: 0,
      buildingId: 'library',
    },
    reporterId: 'student-2214',
    reportCount: 3,
    confidence: 0.82,
    assignedResponderIds: [],
    createdAt: at(6),
    resolvedAt: null,
    timeline: [
      { at: at(6), actor: 'student-2214', action: 'reported', detail: 'Via QR anchor LIB-G-01' },
      { at: at(5), actor: 'system', action: 'triaged', detail: 'P1 — medical, 3 corroborating reports' },
    ],
    evidence: [],
    isDrill: false,
  },
  {
    id: 'inc-seed-2',
    category: 'infrastructure',
    severity: 'P2',
    status: 'dispatched',
    title: 'Water leak — Hostel 8 stairwell',
    description: 'Water leaking through the ceiling of the second-floor stairwell landing.',
    location: {
      lat: CAMPUS_CENTRE.lat - 1.9 * HM,
      lng: CAMPUS_CENTRE.lng - 0.3 * HM,
      label: 'Hostel 8 · Floor 2 stairwell',
      method: 'floor-plan',
      confidence: 0.99,
      floor: 2,
      buildingId: 'hostel-8',
    },
    reporterId: 'staff-118',
    reportCount: 1,
    confidence: 0.6,
    assignedResponderIds: ['resp-mnt-1'],
    createdAt: at(42),
    resolvedAt: null,
    timeline: [
      { at: at(42), actor: 'staff-118', action: 'reported' },
      { at: at(40), actor: 'dispatcher', action: 'dispatched', detail: 'P. Sahoo (maintenance)' },
    ],
    evidence: [],
    isDrill: false,
  },
  {
    id: 'inc-seed-3',
    category: 'harassment',
    severity: 'P1',
    status: 'resolved',
    title: 'Harassment reported near Gate 3',
    description: 'Anonymous report of verbal harassment near the Gate 3 approach road.',
    location: {
      lat: CAMPUS_CENTRE.lat + 2.1 * HM,
      lng: CAMPUS_CENTRE.lng + 1.3 * HM,
      label: 'Gate 3 · Approach road',
      method: 'gps',
      confidence: 0.4,
    },
    reporterId: null,
    reportCount: 1,
    confidence: 0.5,
    assignedResponderIds: ['resp-sec-1'],
    createdAt: at(190),
    resolvedAt: at(164),
    timeline: [
      { at: at(190), actor: 'anonymous', action: 'reported', detail: 'Anonymous via VEIL' },
      { at: at(186), actor: 'dispatcher', action: 'dispatched', detail: 'A. Pradhan (security)' },
      { at: at(164), actor: 'resp-sec-1', action: 'resolved', detail: 'Area patrolled, reporter followed up' },
    ],
    evidence: [],
    isDrill: false,
  },
  {
    id: 'inc-seed-4',
    category: 'fire',
    severity: 'P2',
    status: 'resolved',
    title: 'Burning smell — Block D chemistry lab',
    description: 'Faint burning smell reported near the Block D chemistry lab fume hoods.',
    location: {
      lat: CAMPUS_CENTRE.lat - 0.5 * HM,
      lng: CAMPUS_CENTRE.lng + 0.1 * HM,
      label: 'Block D · Floor 1 · Chem lab',
      method: 'floor-plan',
      confidence: 0.99,
      floor: 1,
      buildingId: 'block-d',
    },
    reporterId: 'student-0907',
    reportCount: 2,
    confidence: 0.71,
    assignedResponderIds: ['resp-fire-1'],
    createdAt: at(1440),
    resolvedAt: at(1408),
    timeline: [
      { at: at(1440), actor: 'student-0907', action: 'reported' },
      { at: at(1434), actor: 'dispatcher', action: 'dispatched', detail: 'K. Das (fire)' },
      { at: at(1408), actor: 'resp-fire-1', action: 'resolved', detail: 'Overheated hotplate, isolated' },
    ],
    evidence: [],
    isDrill: false,
  },
]
