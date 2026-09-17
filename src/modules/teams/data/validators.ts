import { z } from 'zod'
import { MAX_NEEDED_SKILLS, MAX_RECRUITMENT_NOTE_LENGTH, MAX_SKILL_LENGTH } from '../lib/recruitment'

// ── Team ────────────────────────────────────────────────────────────

export const teamStatusValues = ['active', 'disqualified', 'withdrawn'] as const
export const teamRoleValues = ['owner', 'member'] as const
export const invitationTypeValues = ['invite', 'join_request'] as const
export const invitationStatusValues = ['pending', 'accepted', 'declined', 'expired', 'cancelled'] as const

export const createTeamSchema = z.object({
  competition_id: z.string().uuid(),
  track_id: z.string().uuid().optional(),
  track_ids: z.array(z.string().uuid()).optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  avatar_url: z.string().max(500).optional(),
})

export const updateTeamSchema = z.object({
  id: z.string().uuid(),
  track_id: z.string().uuid().nullable().optional(),
  track_ids: z.array(z.string().uuid()).optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  avatar_url: z.string().max(500).nullable().optional(),
  table_number: z.number().int().nullable().optional(),
  table_location: z.string().max(255).nullable().optional(),
  presentation_order: z.number().int().nullable().optional(),
  presentation_time_slot: z.string().datetime().nullable().optional(),
  is_finalist: z.boolean().optional(),
})

/**
 * The team's recruitment posting, edited from the portal by the team owner.
 *
 * The array bound is generous on purpose — `normalizeNeededSkills` is what actually trims and
 * caps the list; the schema only stops an absurd payload from reaching it.
 */
export const updateTeamRecruitmentSchema = z.object({
  team_id: z.string().uuid(),
  looking_for_members: z.boolean(),
  needed_skills: z.array(z.string().max(MAX_SKILL_LENGTH * 2)).max(MAX_NEEDED_SKILLS * 4).optional(),
  recruitment_note: z.string().max(MAX_RECRUITMENT_NOTE_LENGTH).nullable().optional(),
})

export type UpdateTeamRecruitmentInput = z.infer<typeof updateTeamRecruitmentSchema>

export const disqualifyTeamSchema = z.object({
  id: z.string().uuid(),
  disqualification_reason: z.string().min(1),
})

export const manageTeamTracksSchema = z.object({
  team_id: z.string().uuid(),
  track_ids: z.array(z.string().uuid()),
})

export type CreateTeamInput = z.infer<typeof createTeamSchema>
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>
export type DisqualifyTeamInput = z.infer<typeof disqualifyTeamSchema>
export type ManageTeamTracksInput = z.infer<typeof manageTeamTracksSchema>

// ── TeamMember ──────────────────────────────────────────────────────

export const createTeamMemberSchema = z.object({
  team_id: z.string().uuid(),
  customer_user_id: z.string().uuid(),
  competition_id: z.string().uuid(),
  role: z.enum(teamRoleValues).default('member'),
})

export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>

// ── TeamInvitation ──────────────────────────────────────────────────

export const createTeamInvitationSchema = z.object({
  team_id: z.string().uuid(),
  invitee_id: z.string().uuid(),
  type: z.enum(invitationTypeValues).default('invite'),
  message: z.string().optional(),
  expires_at: z.string().datetime(),
  competition_id: z.string().uuid(),
})

export const updateTeamInvitationSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['accepted', 'declined', 'cancelled'] as const),
})

export type CreateTeamInvitationInput = z.infer<typeof createTeamInvitationSchema>
export type UpdateTeamInvitationInput = z.infer<typeof updateTeamInvitationSchema>
