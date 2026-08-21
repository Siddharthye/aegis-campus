import { randomUUID } from 'node:crypto'
import { escalationRationale, severityFromCorroboration } from '@/domain/corroboration'
import { recommendResponders, type DispatchRecommendation } from '@/domain/dispatch'
import { readSla } from '@/domain/sla'
import type {
  Incident,
  IncidentCategory,
  IncidentStatus,
  LocatedPosition,
  Responder,
  Severity,
  TimelineEntry,
} from '@/domain/types'
import { store } from '@/store'
import { seedIncidents, seedResponders } from './seed'

const INCIDENTS = 'incidents'
const RESPONDERS = 'responders'

/** Seeds demo data on first read so a fresh clone shows a living product. */
async function loadIncidents(): Promise<Incident[]> {
  const existing = await store.readCollection<Incident>(INCIDENTS)
  if (existing.length > 0) return existing
  await store.writeCollection(INCIDENTS, seedIncidents)
  return seedIncidents
}

async function loadResponders(): Promise<Responder[]> {
  const existing = await store.readCollection<Responder>(RESPONDERS)
  if (existing.length > 0) return existing
  await store.writeCollection(RESPONDERS, seedResponders)
  return seedResponders
}

const entry = (actor: string, action: string, detail?: string): TimelineEntry => ({
  at: new Date().toISOString(),
  actor,
  action,
  ...(detail ? { detail } : {}),
})

export interface CreateIncidentInput {
  category: IncidentCategory
  severity: Severity
  title: string
  description: string
  location: LocatedPosition
  reporterId: string | null
  isDrill?: boolean
  /** SHA-256 of a VEIL case token, when the reporter wants to follow up. */
  caseTokenHash?: string
}

/** All incidents, newest first. */
export async function listIncidents({ includeDrills = true } = {}): Promise<Incident[]> {
  const incidents = await loadIncidents()
  const visible = includeDrills ? incidents : incidents.filter((incident) => !incident.isDrill)
  return [...visible].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getIncident(id: string): Promise<Incident | null> {
  const incidents = await loadIncidents()
  return incidents.find((incident) => incident.id === id) ?? null
}

/** Records a new incident and publishes it to the live event stream. */
export async function createIncident(input: CreateIncidentInput): Promise<Incident> {
  const incidents = await loadIncidents()

  const incident: Incident = {
    id: `inc-${randomUUID().slice(0, 8)}`,
    category: input.category,
    severity: input.severity,
    status: 'reported',
    title: input.title,
    description: input.description,
    location: input.location,
    reporterId: input.reporterId,
    reportCount: 1,
    confidence: input.reporterId === null ? 0.5 : 0.6,
    assignedResponderIds: [],
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    timeline: [entry(input.reporterId ?? 'anonymous', 'reported', input.location.label)],
    isDrill: input.isDrill ?? false,
    ...(input.caseTokenHash ? { caseTokenHash: input.caseTokenHash } : {}),
  }

  await store.writeCollection(INCIDENTS, [...incidents, incident])
  await store.appendEvent('incident.created', incident)
  return incident
}

/** Ranked dispatch suggestions for one incident. */
export async function getRecommendations(incidentId: string): Promise<DispatchRecommendation[]> {
  const incident = await getIncident(incidentId)
  if (!incident) return []
  return recommendResponders(incident, await loadResponders())
}

/**
 * Assigns a responder and moves the incident to `dispatched`. Also flips the
 * responder to `assigned` so they stop appearing in recommendations.
 */
export async function assignResponder(
  incidentId: string,
  responderId: string,
  actor = 'dispatcher',
): Promise<Incident | null> {
  const [incidents, responders] = await Promise.all([loadIncidents(), loadResponders()])
  const incident = incidents.find((item) => item.id === incidentId)
  const responder = responders.find((item) => item.id === responderId)
  if (!incident || !responder) return null

  const updated: Incident = {
    ...incident,
    status: 'dispatched',
    assignedResponderIds: [...new Set([...incident.assignedResponderIds, responderId])],
    timeline: [...incident.timeline, entry(actor, 'dispatched', `${responder.name} (${responder.unit})`)],
  }

  await store.writeCollection(
    INCIDENTS,
    incidents.map((item) => (item.id === incidentId ? updated : item)),
  )
  await store.writeCollection(
    RESPONDERS,
    responders.map((item) =>
      item.id === responderId ? { ...item, status: 'assigned' as const, incidentId } : item,
    ),
  )
  await store.appendEvent('incident.updated', updated)
  return updated
}

/**
 * Advances an incident through its lifecycle. Resolving frees its responders.
 */
export async function updateStatus(
  incidentId: string,
  status: IncidentStatus,
  actor: string,
  detail?: string,
): Promise<Incident | null> {
  const incidents = await loadIncidents()
  const incident = incidents.find((item) => item.id === incidentId)
  if (!incident) return null

  const updated: Incident = {
    ...incident,
    status,
    resolvedAt: status === 'resolved' ? new Date().toISOString() : incident.resolvedAt,
    timeline: [...incident.timeline, entry(actor, status, detail)],
  }

  await store.writeCollection(
    INCIDENTS,
    incidents.map((item) => (item.id === incidentId ? updated : item)),
  )

  if (status === 'resolved' && incident.assignedResponderIds.length > 0) {
    const responders = await loadResponders()
    await store.writeCollection(
      RESPONDERS,
      responders.map((item) =>
        incident.assignedResponderIds.includes(item.id)
          ? { ...item, status: 'available' as const, incidentId: null }
          : item,
      ),
    )
  }

  await store.appendEvent('incident.updated', updated)
  return updated
}

export async function listResponders(): Promise<Responder[]> {
  return loadResponders()
}

/** Headline numbers for the control room, the landing page, and NEXBOT. */
export async function getStats() {
  const now = new Date()
  const [incidents, responders] = await Promise.all([loadIncidents(), loadResponders()])
  const open = incidents.filter((incident) => incident.status !== 'resolved')
  const resolved = incidents.filter((incident) => incident.resolvedAt !== null)

  const resolutionMinutes = resolved.map(
    (incident) =>
      (new Date(incident.resolvedAt as string).getTime() - new Date(incident.createdAt).getTime()) /
      60_000,
  )
  const meanResolutionMin =
    resolutionMinutes.length === 0
      ? null
      : resolutionMinutes.reduce((sum, minutes) => sum + minutes, 0) / resolutionMinutes.length

  const slaBreaches = incidents.filter((incident) => readSla(incident, now).breached).length

  return {
    openIncidents: open.length,
    p0Open: open.filter((incident) => incident.severity === 'P0').length,
    totalIncidents: incidents.length,
    respondersAvailable: responders.filter((responder) => responder.status === 'available').length,
    responders: responders.length,
    meanResolutionMin: meanResolutionMin === null ? null : Math.round(meanResolutionMin * 10) / 10,
    slaBreaches,
  }
}

/**
 * Records corroboration arriving from FUSION: a higher report count, a new
 * confidence, and — when the corroboration justifies it — an automatic
 * severity escalation with its reason written into the timeline.
 *
 * @example
 * await corroborateIncident('inc-4f9a12c0', 21, 0.96)
 * // => incident now P0, timeline shows '21 corroborating reports at 96% confidence'
 */
export async function corroborateIncident(
  incidentId: string,
  reportCount: number,
  confidence: number,
): Promise<Incident | null> {
  const incidents = await loadIncidents()
  const incident = incidents.find((item) => item.id === incidentId)
  if (!incident) return null

  const severity = severityFromCorroboration(incident.severity, reportCount, confidence)
  const escalated = severity !== incident.severity
  const rationale = escalationRationale(reportCount, confidence)

  const updated: Incident = {
    ...incident,
    reportCount,
    confidence,
    severity,
    timeline: [
      ...incident.timeline,
      entry('fusion', 'corroborated', rationale),
      ...(escalated ? [entry('system', 'escalated', `${incident.severity} → ${severity} — ${rationale}`)] : []),
    ],
  }

  await store.writeCollection(
    INCIDENTS,
    incidents.map((item) => (item.id === incidentId ? updated : item)),
  )
  await store.appendEvent('incident.updated', updated)
  return updated
}

/**
 * Records a geofenced broadcast against an incident. AEGIS delegates actual
 * delivery to SIREN over HTTP; this writes the audit entry that proves who
 * was told what, and when.
 *
 * @example
 * await recordBroadcast('inc-4f9a12c0', 'Evacuate via the west stairwell')
 */
export async function recordBroadcast(
  incidentId: string,
  message: string,
  actor = 'dispatcher',
): Promise<Incident | null> {
  const incidents = await loadIncidents()
  const incident = incidents.find((item) => item.id === incidentId)
  if (!incident) return null

  const updated: Incident = {
    ...incident,
    timeline: [...incident.timeline, entry(actor, 'broadcast', message)],
  }

  await store.writeCollection(
    INCIDENTS,
    incidents.map((item) => (item.id === incidentId ? updated : item)),
  )
  await store.appendEvent('incident.broadcast', { incidentId, message, at: updated.timeline.at(-1)?.at })
  return updated
}

/** Removes every drill-produced incident, leaving real ones untouched. */
export async function clearDrillIncidents(): Promise<void> {
  const incidents = await loadIncidents()
  await store.writeCollection(
    INCIDENTS,
    incidents.filter((incident) => !incident.isDrill),
  )
  await store.appendEvent('drill.cleared', { at: new Date().toISOString() })
}

/**
 * Finds an incident by the hash of its VEIL case token.
 *
 * Takes a hash rather than a token so the raw token never reaches this layer
 * — hashing happens at the edge and the plaintext is discarded there.
 *
 * @example
 * await findIncidentByCaseTokenHash(await hashCaseToken('AEG-7K2M-QP49'))
 */
export async function findIncidentByCaseTokenHash(hash: string): Promise<Incident | null> {
  const incidents = await loadIncidents()
  return incidents.find((incident) => incident.caseTokenHash === hash) ?? null
}
