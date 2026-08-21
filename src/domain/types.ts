import type { EvidenceItem } from './evidence'

/**
 * Core vocabulary for AEGIS. Everything in `domain/` is pure data and pure
 * functions — no I/O, no framework imports — so the logic that decides how an
 * emergency is handled stays readable and unit-testable.
 */

/** Incident priority. P0 is life-threatening; P3 is informational. */
export type Severity = 'P0' | 'P1' | 'P2' | 'P3'

export type IncidentCategory =
  | 'fire'
  | 'medical'
  | 'harassment'
  | 'infrastructure'
  | 'security'
  | 'other'

export type IncidentStatus = 'reported' | 'triaged' | 'dispatched' | 'on-scene' | 'resolved'

export type ResponderUnit = 'security' | 'medical' | 'fire' | 'maintenance'

export type ResponderStatus = 'available' | 'assigned' | 'en-route' | 'on-scene' | 'off-duty'

export interface Coordinates {
  lat: number
  lng: number
}

/** Where an incident is, and how sure we are about it. */
export interface LocatedPosition extends Coordinates {
  /** Human-readable place, e.g. "Block C · Floor 3 · Room 302". */
  label: string
  /** How the position was obtained — drives the confidence shown in the UI. */
  method: 'floor-plan' | 'gps' | 'map-tap'
  /** 0–1. A floor-plan pick is ~0.85; raw GPS is ~0.4 and has no floor. */
  confidence: number
  /** Present only when the method can resolve one (a floor-plan pick can). */
  floor?: number
  buildingId?: string
}

/** One step in an incident's audit trail. Every transition is recorded. */
export interface TimelineEntry {
  at: string
  actor: string
  action: string
  detail?: string
}

export interface Incident {
  id: string
  category: IncidentCategory
  severity: Severity
  status: IncidentStatus
  title: string
  description: string
  location: LocatedPosition
  /** Null when reported anonymously — see VEIL. */
  reporterId: string | null
  reportCount: number
  /** 0–1 corroboration confidence, from FUSION when available. */
  confidence: number
  assignedResponderIds: string[]
  createdAt: string
  resolvedAt: string | null
  timeline: TimelineEntry[]
  /** Photos attached by the reporter, already downscaled and EXIF-stripped. */
  evidence: EvidenceItem[]
  /**
   * The FUSION module's id for this incident, when FUSION founded it. Lets a
   * later corroboration from FUSION resolve back to the AEGIS incident.
   */
  fusionIncidentId?: string
  /** True when this incident was produced by a drill scenario, not reality. */
  isDrill: boolean
  /**
   * SHA-256 of the reporter's VEIL case token, when they asked to follow up.
   * The token itself is never stored, so this can verify a token presented
   * later but can never produce one. See `domain/case-token.ts`.
   */
  caseTokenHash?: string
}

export interface Responder {
  id: string
  name: string
  unit: ResponderUnit
  status: ResponderStatus
  location: Coordinates
  /** Incident currently assigned, if any. */
  incidentId: string | null
}
