import { z } from 'zod'

export const createTrackSchema = z.object({
  competition_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  short_description: z.string().optional(),
  description: z.string().optional(),
  attachment_ids: z.array(z.string().uuid()).default([]),
  color: z.string().max(7).default('#6366f1'),
  icon_url: z.string().max(500).optional(),
  max_teams: z.number().int().min(1).optional(),
  order: z.number().int().default(0),
  mentor_ids: z.array(z.string().uuid()).default([]),
})

export const updateTrackSchema = z.object({
  id: z.string().uuid(),
  competition_id: z.string().uuid().optional(),
  name: z.string().min(1).max(255).optional(),
  short_description: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  attachment_ids: z.array(z.string().uuid()).optional(),
  color: z.string().max(7).optional(),
  icon_url: z.string().max(500).nullable().optional(),
  max_teams: z.number().int().min(1).nullable().optional(),
  order: z.number().int().optional(),
  mentor_ids: z.array(z.string().uuid()).optional(),
})

export type CreateTrackInput = z.infer<typeof createTrackSchema>
export type UpdateTrackInput = z.infer<typeof updateTrackSchema>
