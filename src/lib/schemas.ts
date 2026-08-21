import { z } from 'zod'
import { MAX_EVIDENCE_ITEMS, isAcceptableEvidence } from '@/domain/evidence'

/**
 * Evidence arrives already downscaled and re-encoded by the browser. The
 * server still re-checks type and size, because a client-side guarantee is a
 * convenience for honest callers, not a security boundary.
 */
const evidenceSchema = z.object({
  id: z.string().min(1).max(40),
  dataUrl: z.string().refine(isAcceptableEvidence, 'Unsupported or oversized image'),
  capturedAt: z.string(),
  metadataStripped: z.literal(true),
  byteSize: z.number().int().nonnegative(),
})

export const severitySchema = z.enum(['P0', 'P1', 'P2', 'P3'])
export const categorySchema = z.enum([
  'fire',
  'medical',
  'harassment',
  'infrastructure',
  'security',
  'other',
])
export const statusSchema = z.enum(['reported', 'triaged', 'dispatched', 'on-scene', 'resolved'])

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().min(1).max(160),
  method: z.enum(['qr-anchor', 'gps', 'map-tap', 'wifi']),
  confidence: z.number().min(0).max(1),
  floor: z.number().int().min(-2).max(30).optional(),
  buildingId: z.string().max(60).optional(),
})

export const createIncidentSchema = z.object({
  category: categorySchema,
  severity: severitySchema,
  title: z.string().min(1).max(140),
  description: z.string().min(1).max(2000),
  location: locationSchema,
  /** Null reports anonymously. */
  reporterId: z.string().min(1).max(80).nullable().default(null),
  isDrill: z.boolean().default(false),
  evidence: z.array(evidenceSchema).max(MAX_EVIDENCE_ITEMS).default([]),
  /**
   * Ask for a VEIL case token so this report can be followed up anonymously.
   * The token is returned once, in the create response, and never again.
   */
  wantsCaseToken: z.boolean().default(false),
})

/** `GET /api/cases/:token` — the token a reporter presents to check status. */
export const caseTokenSchema = z
  .string()
  .min(6)
  .max(40)
  .regex(/^[A-Za-z0-9\s-]+$/, 'Case tokens contain only letters, digits and dashes')

export const updateIncidentSchema = z.object({
  status: statusSchema.optional(),
  assignResponderId: z.string().min(1).optional(),
  actor: z.string().min(1).max(80).default('dispatcher'),
  detail: z.string().max(300).optional(),
})

export const assistSchema = z.object({
  question: z.string().min(1).max(500),
})
