import { z } from 'zod'

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export const createIncidentSchema = z.object({
  competitionId: z.string().uuid(),
  description: z.string().min(10).max(10000),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  reportedUserId: z.string().uuid().nullable().optional(),
  anonymous: z.boolean().default(false),
})

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export const updateIncidentSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(10).max(10000).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['REPORTED', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']).optional(),
  adminNotes: z.string().max(10000).nullable().optional(),
  reportedUserId: z.string().uuid().nullable().optional(),
})

export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>

// ---------------------------------------------------------------------------
// Resolve
// ---------------------------------------------------------------------------

export const resolveIncidentSchema = z.object({
  id: z.string().uuid(),
  resolutionDescription: z.string().min(1).max(10000),
  status: z.enum(['RESOLVED', 'DISMISSED']).default('RESOLVED'),
})

export type ResolveIncidentInput = z.infer<typeof resolveIncidentSchema>

// ---------------------------------------------------------------------------
// List query
// ---------------------------------------------------------------------------

export const listIncidentQuerySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('created_at'),
    sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
    competitionId: z.string().uuid().optional(),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    status: z.enum(['REPORTED', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']).optional(),
    format: z.enum(['json', 'csv']).optional(),
  })
  .passthrough()

export type ListIncidentQuery = z.infer<typeof listIncidentQuerySchema>

// ---------------------------------------------------------------------------
// List item schema (OpenAPI doc)
// ---------------------------------------------------------------------------

export const incidentListItemSchema = z.object({
  id: z.string().uuid(),
  competitionId: z.string().uuid(),
  reporterId: z.string().uuid().nullable(),
  reportedUserId: z.string().uuid().nullable(),
  description: z.string(),
  severity: z.string(),
  status: z.string(),
  adminNotes: z.string().nullable(),
  resolvedBy: z.string().uuid().nullable(),
  resolutionDescription: z.string().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type IncidentListItem = z.infer<typeof incidentListItemSchema>
