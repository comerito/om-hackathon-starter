import { z } from 'zod'

// ---------------------------------------------------------------------------
// Create Track
// ---------------------------------------------------------------------------

export const createTrackSchema = z.object({
  competitionId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(10000).nullable().optional(),
  color: z.string().max(50).optional().default('#6366f1'),
  iconUrl: z.string().url().max(2000).nullable().optional(),
  maxTeams: z.number().int().positive().nullable().optional(),
  order: z.number().int().min(0).default(0),
  mentorIds: z.array(z.string().uuid()).optional().default([]),
})

export type CreateTrackInput = z.infer<typeof createTrackSchema>

// ---------------------------------------------------------------------------
// Update Track
// ---------------------------------------------------------------------------

export const updateTrackSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(10000).nullable().optional(),
  color: z.string().max(50).optional(),
  iconUrl: z.string().url().max(2000).nullable().optional(),
  maxTeams: z.number().int().positive().nullable().optional(),
  order: z.number().int().min(0).optional(),
  mentorIds: z.array(z.string().uuid()).optional(),
  isActive: z.boolean().optional(),
})

export type UpdateTrackInput = z.infer<typeof updateTrackSchema>

// ---------------------------------------------------------------------------
// List Tracks
// ---------------------------------------------------------------------------

export const listTrackSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  sortField: z.string().optional().default('order'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
  competitionId: z.string().uuid(),
  name: z.string().optional(),
})

export type ListTrackQuery = z.infer<typeof listTrackSchema>

// ---------------------------------------------------------------------------
// Track List Item (OpenAPI response shape)
// ---------------------------------------------------------------------------

export const trackListItemSchema = z.object({
  id: z.string().uuid(),
  competitionId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  iconUrl: z.string().nullable(),
  maxTeams: z.number().nullable(),
  order: z.number(),
  mentorIds: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type TrackListItem = z.infer<typeof trackListItemSchema>
