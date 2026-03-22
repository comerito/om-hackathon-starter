import { z } from 'zod'

export const sponsorTierValues = ['title', 'gold', 'silver', 'partner', 'in_kind'] as const
export const prizeCategoryValues = ['track_placement', 'special_award', 'sponsor_prize', 'peoples_choice'] as const

// ── Sponsor ─────────────────────────────────────────────────────
export const createSponsorSchema = z.object({
  competition_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  tier: z.enum(sponsorTierValues).default('partner'),
  logo_url: z.string().min(1).max(1000),
  website_url: z.string().max(1000).optional(),
  description: z.string().optional(),
  challenge_title: z.string().max(255).optional(),
  challenge_description: z.string().optional(),
  challenge_resources_url: z.string().max(1000).optional(),
  contact_name: z.string().max(255).optional(),
  contact_email: z.string().email().max(255).optional(),
  order: z.number().int().default(0),
  is_visible: z.boolean().default(true),
})

export const updateSponsorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  tier: z.enum(sponsorTierValues).optional(),
  logo_url: z.string().min(1).max(1000).optional(),
  website_url: z.string().max(1000).nullable().optional(),
  description: z.string().nullable().optional(),
  challenge_title: z.string().max(255).nullable().optional(),
  challenge_description: z.string().nullable().optional(),
  challenge_resources_url: z.string().max(1000).nullable().optional(),
  contact_name: z.string().max(255).nullable().optional(),
  contact_email: z.string().email().max(255).nullable().optional(),
  order: z.number().int().optional(),
  is_visible: z.boolean().optional(),
})

// ── Prize ───────────────────────────────────────────────────────
export const createPrizeSchema = z.object({
  competition_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.enum(prizeCategoryValues).default('special_award'),
  track_id: z.string().uuid().nullable().optional(),
  sponsor_id: z.string().uuid().nullable().optional(),
  value: z.string().max(255).optional(),
  rank: z.number().int().nullable().optional(),
  icon_url: z.string().max(500).optional(),
  order: z.number().int().default(0),
})

export const updatePrizeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  category: z.enum(prizeCategoryValues).optional(),
  track_id: z.string().uuid().nullable().optional(),
  sponsor_id: z.string().uuid().nullable().optional(),
  value: z.string().max(255).nullable().optional(),
  rank: z.number().int().nullable().optional(),
  icon_url: z.string().max(500).nullable().optional(),
  order: z.number().int().optional(),
})

export const assignPrizeSchema = z.object({
  id: z.string().uuid(),
  winning_project_id: z.string().uuid(),
  winning_team_id: z.string().uuid(),
})

export const unassignPrizeSchema = z.object({
  id: z.string().uuid(),
})

// ── Vote ────────────────────────────────────────────────────────
export const castVoteSchema = z.object({
  competition_id: z.string().uuid(),
  project_id: z.string().uuid(),
})

export const retractVoteSchema = z.object({
  vote_id: z.string().uuid(),
})

export type CreateSponsorInput = z.infer<typeof createSponsorSchema>
export type UpdateSponsorInput = z.infer<typeof updateSponsorSchema>
export type CreatePrizeInput = z.infer<typeof createPrizeSchema>
export type UpdatePrizeInput = z.infer<typeof updatePrizeSchema>
export type AssignPrizeInput = z.infer<typeof assignPrizeSchema>
export type CastVoteInput = z.infer<typeof castVoteSchema>
