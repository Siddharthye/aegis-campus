import { z } from 'zod'

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
})

export const updateIncidentSchema = z.object({
  status: statusSchema.optional(),
  assignResponderId: z.string().min(1).optional(),
  actor: z.string().min(1).max(80).default('dispatcher'),
  detail: z.string().max(300).optional(),
})

export const assistSchema = z.object({
  question: z.string().min(1).max(500),
})
