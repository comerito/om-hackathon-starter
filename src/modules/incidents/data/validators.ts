import { z } from 'zod'

export const incidentSeverityValues = ['low', 'medium', 'high', 'critical'] as const
export const incidentStatusValues = ['reported', 'under_review', 'resolved', 'dismissed'] as const

export const createIncidentSchema = z.object({
  competition_id: z.string().uuid(),
  description: z.string().min(1),
  severity: z.enum(incidentSeverityValues).default('low'),
  reported_user_id: z.string().uuid().nullable().optional(),
  anonymous: z.boolean().default(false),
})

export const updateIncidentSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(incidentStatusValues).optional(),
  admin_notes: z.string().nullable().optional(),
  severity: z.enum(incidentSeverityValues).optional(),
})

export const resolveIncidentSchema = z.object({
  id: z.string().uuid(),
  resolution_description: z.string().min(1),
  status: z.enum(['resolved', 'dismissed'] as const).default('resolved'),
})

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>
export type ResolveIncidentInput = z.infer<typeof resolveIncidentSchema>
