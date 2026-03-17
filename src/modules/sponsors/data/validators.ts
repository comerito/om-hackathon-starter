import { z } from 'zod'

// ---------------------------------------------------------------------------
// Sponsor schemas
// ---------------------------------------------------------------------------

export const createSponsorSchema = z.object({
  competitionId: z.string().uuid(),
  name: z.string().min(1).max(255),
  tier: z.enum(['TITLE', 'GOLD', 'SILVER', 'PARTNER', 'IN_KIND']),
  logoUrl: z.string().url().max(2000),
  websiteUrl: z.string().url().max(2000).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  challengeTitle: z.string().max(255).nullable().optional(),
  challengeDescription: z.string().max(10000).nullable().optional(),
  challengeResourcesUrl: z.string().url().max(2000).nullable().optional(),
  contactName: z.string().max(255).nullable().optional(),
  contactEmail: z.string().email().max(255).nullable().optional(),
  order: z.number().int().min(0).default(0),
  isVisible: z.boolean().default(true),
})

export type CreateSponsorInput = z.infer<typeof createSponsorSchema>

export const updateSponsorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  tier: z.enum(['TITLE', 'GOLD', 'SILVER', 'PARTNER', 'IN_KIND']).optional(),
  logoUrl: z.string().url().max(2000).optional(),
  websiteUrl: z.string().url().max(2000).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  challengeTitle: z.string().max(255).nullable().optional(),
  challengeDescription: z.string().max(10000).nullable().optional(),
  challengeResourcesUrl: z.string().url().max(2000).nullable().optional(),
  contactName: z.string().max(255).nullable().optional(),
  contactEmail: z.string().email().max(255).nullable().optional(),
  order: z.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateSponsorInput = z.infer<typeof updateSponsorSchema>

// ---------------------------------------------------------------------------
// Prize schemas
// ---------------------------------------------------------------------------

export const createPrizeSchema = z
  .object({
    competitionId: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().max(5000).nullable().optional(),
    category: z.enum(['TRACK_PLACEMENT', 'SPECIAL_AWARD', 'SPONSOR_PRIZE', 'PEOPLES_CHOICE']),
    trackId: z.string().uuid().nullable().optional(),
    sponsorId: z.string().uuid().nullable().optional(),
    value: z.string().max(255).nullable().optional(),
    rank: z.number().int().min(1).nullable().optional(),
    iconUrl: z.string().url().max(2000).nullable().optional(),
    order: z.number().int().min(0).default(0),
  })
  .refine(
    (data) => {
      if (data.category === 'TRACK_PLACEMENT') {
        return !!data.trackId && data.rank != null
      }
      return true
    },
    { message: 'TRACK_PLACEMENT requires trackId and rank', path: ['trackId'] },
  )
  .refine(
    (data) => {
      if (data.category === 'SPONSOR_PRIZE') {
        return !!data.sponsorId
      }
      return true
    },
    { message: 'SPONSOR_PRIZE requires sponsorId', path: ['sponsorId'] },
  )

export type CreatePrizeInput = z.infer<typeof createPrizeSchema>

export const updatePrizeSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(5000).nullable().optional(),
    category: z.enum(['TRACK_PLACEMENT', 'SPECIAL_AWARD', 'SPONSOR_PRIZE', 'PEOPLES_CHOICE']).optional(),
    trackId: z.string().uuid().nullable().optional(),
    sponsorId: z.string().uuid().nullable().optional(),
    value: z.string().max(255).nullable().optional(),
    rank: z.number().int().min(1).nullable().optional(),
    iconUrl: z.string().url().max(2000).nullable().optional(),
    order: z.number().int().min(0).optional(),
  })

export type UpdatePrizeInput = z.infer<typeof updatePrizeSchema>

// ---------------------------------------------------------------------------
// Prize assignment
// ---------------------------------------------------------------------------

export const assignPrizeSchema = z.object({
  prizeId: z.string().uuid(),
  projectId: z.string().uuid(),
  teamId: z.string().uuid(),
})

export type AssignPrizeInput = z.infer<typeof assignPrizeSchema>

export const unassignPrizeSchema = z.object({
  prizeId: z.string().uuid(),
})

export type UnassignPrizeInput = z.infer<typeof unassignPrizeSchema>

// ---------------------------------------------------------------------------
// Vote schemas
// ---------------------------------------------------------------------------

export const castVoteSchema = z.object({
  competitionId: z.string().uuid(),
  projectId: z.string().uuid(),
})

export type CastVoteInput = z.infer<typeof castVoteSchema>

export const retractVoteSchema = z.object({
  competitionId: z.string().uuid(),
  projectId: z.string().uuid(),
})

export type RetractVoteInput = z.infer<typeof retractVoteSchema>

// ---------------------------------------------------------------------------
// List item schemas (OpenAPI doc)
// ---------------------------------------------------------------------------

export const sponsorListItemSchema = z.object({
  id: z.string().uuid(),
  competitionId: z.string().uuid(),
  name: z.string(),
  tier: z.string(),
  logoUrl: z.string(),
  websiteUrl: z.string().nullable(),
  description: z.string().nullable(),
  challengeTitle: z.string().nullable(),
  challengeDescription: z.string().nullable(),
  challengeResourcesUrl: z.string().nullable(),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  order: z.number(),
  isVisible: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type SponsorListItem = z.infer<typeof sponsorListItemSchema>

export const prizeListItemSchema = z.object({
  id: z.string().uuid(),
  competitionId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  trackId: z.string().nullable(),
  sponsorId: z.string().nullable(),
  value: z.string().nullable(),
  rank: z.number().nullable(),
  iconUrl: z.string().nullable(),
  winningProjectId: z.string().nullable(),
  winningTeamId: z.string().nullable(),
  awardedAt: z.string().datetime().nullable(),
  awardedBy: z.string().nullable(),
  order: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type PrizeListItem = z.infer<typeof prizeListItemSchema>
