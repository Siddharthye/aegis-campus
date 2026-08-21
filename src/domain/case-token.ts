import { sha256Hex } from './crypto-hash'
import type { Incident, IncidentCategory, IncidentStatus, Severity, TimelineEntry } from './types'

/**
 * VEIL — anonymous case follow-up.
 *
 * Reporting anonymously should not mean reporting into a void. A reporter who
 * gives no identity still gets a one-way case token: the server stores only
 * `sha256(token)`, so it can *verify* a token presented later but can never
 * derive one, list one, or link it back to a person. Losing the token means
 * losing the case — that is the cost of genuine anonymity, and the UI says so.
 */

/** Ambiguous characters are excluded: no O/0, I/1, or S/5 to mistype. */
const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXY2346789'
const GROUP_LENGTH = 4
const GROUP_COUNT = 2

/**
 * A fresh case token, formatted `AEG-XXXX-XXXX` so it can be read aloud,
 * written on a hand, or typed without ambiguity.
 *
 * Uses the platform CSPRNG — a predictable token would let anyone enumerate
 * other people's cases.
 *
 * @example
 * generateCaseToken() // => 'AEG-7K2M-QP49'
 */
export function generateCaseToken(): string {
  const bytes = new Uint8Array(GROUP_LENGTH * GROUP_COUNT)
  globalThis.crypto.getRandomValues(bytes)

  const characters = Array.from(bytes, (byte) => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length])
  const groups = Array.from({ length: GROUP_COUNT }, (_, index) =>
    characters.slice(index * GROUP_LENGTH, (index + 1) * GROUP_LENGTH).join(''),
  )

  return `AEG-${groups.join('-')}`
}

/**
 * Normalises user input before hashing, so a token still resolves when it is
 * typed in lower case, with spaces, or without its dashes.
 *
 * @example
 * normaliseCaseToken(' aeg 7k2m qp49 ') // => 'AEG-7K2M-QP49'
 */
export function normaliseCaseToken(raw: string): string {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const body = compact.startsWith('AEG') ? compact.slice(3) : compact
  const groups = body.match(/.{1,4}/g) ?? []
  return `AEG-${groups.slice(0, GROUP_COUNT).join('-')}`
}

/** Hash stored against an incident. The token itself is never persisted. */
export const hashCaseToken = (token: string): Promise<string> => sha256Hex(normaliseCaseToken(token))

/**
 * Timeline actions a reporter may see. Everything else — corroboration
 * counts, confidence scores, escalation reasoning, responder identities — is
 * internal, and leaking it through an unauthenticated endpoint would turn a
 * follow-up feature into an intelligence feed about the control room.
 */
const REPORTER_VISIBLE_ACTIONS = new Set<string>([
  'reported',
  'triaged',
  'dispatched',
  'on-scene',
  'resolved',
])

/** What a reporter is told about their own case. Deliberately narrow. */
export interface CaseStatus {
  status: IncidentStatus
  severity: Severity
  category: IncidentCategory
  locationLabel: string
  createdAt: string
  resolvedAt: string | null
  /** Public-safe transitions only, oldest first, with actors stripped. */
  updates: { at: string; action: string }[]
}

/**
 * The reporter-facing projection of an incident.
 *
 * Note what is *absent*: the incident id, reporter id, description,
 * coordinates, responder names, and every internal timeline entry. A case
 * token proves you filed something; it does not grant a window into
 * operations.
 *
 * @example
 * toCaseStatus(incident).updates
 * // => [{ at: '2026-08-21T…', action: 'reported' }, { …, action: 'dispatched' }]
 */
export function toCaseStatus(incident: Incident): CaseStatus {
  const visible = (entry: TimelineEntry) => REPORTER_VISIBLE_ACTIONS.has(entry.action)

  return {
    status: incident.status,
    severity: incident.severity,
    category: incident.category,
    locationLabel: incident.location.label,
    createdAt: incident.createdAt,
    resolvedAt: incident.resolvedAt,
    updates: incident.timeline
      .filter(visible)
      .map((entry) => ({ at: entry.at, action: entry.action })),
  }
}

/**
 * Plain-language explanation of where a case stands, so the reporter reads a
 * sentence rather than decoding a status enum.
 *
 * @example
 * describeCaseStatus('dispatched') // => 'A responder is on the way.'
 */
export function describeCaseStatus(status: IncidentStatus): string {
  const explanations: Record<IncidentStatus, string> = {
    reported: 'Received. The control room has your report and is assessing it.',
    triaged: 'Assessed and prioritised. A responder is being assigned.',
    dispatched: 'A responder is on the way.',
    'on-scene': 'A responder has arrived at the location.',
    resolved: 'Closed. Thank you for reporting it.',
  }
  return explanations[status]
}
