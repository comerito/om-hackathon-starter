import { z } from 'zod'

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export const createTeamSchema = z.object({
  competitionId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(5000).nullable().optional(),
  avatarUrl: z.string().url().max(2000).nullable().optional(),
})

export type CreateTeamInput = z.infer<typeof createTeamSchema>

export const updateTeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  avatarUrl: z.string().url().max(2000).nullable().optional(),
  trackId: z.string().uuid().nullable().optional(),
  status: z.enum(['ACTIVE', 'DISQUALIFIED', 'WITHDRAWN']).optional(),
  presentationOrder: z.number().int().nullable().optional(),
  presentationTimeSlot: z.string().datetime().nullable().optional(),
  isFinalist: z.boolean().optional(),
  tableNumber: z.number().int().nullable().optional(),
  tableLocation: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateTeamInput = z.infer<typeof updateTeamSchema>

export const listTeamSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  sortField: z.string().optional().default('name'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
  competitionId: z.string().uuid(),
  trackId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'DISQUALIFIED', 'WITHDRAWN']).optional(),
  name: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
})

export type ListTeamQuery = z.infer<typeof listTeamSchema>

export const teamListItemSchema = z.object({
  id: z.string().uuid(),
  competitionId: z.string().uuid(),
  trackId: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  status: z.string(),
  isFinalist: z.boolean(),
  tableNumber: z.number().nullable(),
  tableLocation: z.string().nullable(),
  presentationOrder: z.number().nullable(),
  memberCount: z.number().optional(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type TeamListItem = z.infer<typeof teamListItemSchema>

// ---------------------------------------------------------------------------
// TeamMember
// ---------------------------------------------------------------------------

export const createTeamMemberSchema = z.object({
  teamId: z.string().uuid(),
  customerUserId: z.string().uuid(),
  competitionId: z.string().uuid(),
  role: z.enum(['OWNER', 'MEMBER']).optional().default('MEMBER'),
})

export type CreateTeamMemberInput = z.infer<typeof createTeamMemberSchema>

export const teamMemberListItemSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  customerUserId: z.string().uuid(),
  competitionId: z.string().uuid(),
  role: z.string(),
  joinedAt: z.string().datetime(),
})

export type TeamMemberListItem = z.infer<typeof teamMemberListItemSchema>

// ---------------------------------------------------------------------------
// TeamInvitation
// ---------------------------------------------------------------------------

export const createTeamInvitationSchema = z.object({
  teamId: z.string().uuid(),
  inviteeId: z.string().uuid(),
  type: z.enum(['INVITE', 'JOIN_REQUEST']).optional().default('INVITE'),
  message: z.string().max(2000).nullable().optional(),
  competitionId: z.string().uuid(),
  expiresInHours: z.number().int().min(1).max(720).optional().default(48),
})

export type CreateTeamInvitationInput = z.infer<typeof createTeamInvitationSchema>

export const listTeamInvitationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  sortField: z.string().optional().default('created_at'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  teamId: z.string().uuid().optional(),
  inviteeId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED']).optional(),
  competitionId: z.string().uuid().optional(),
  type: z.enum(['INVITE', 'JOIN_REQUEST']).optional(),
})

export type ListTeamInvitationQuery = z.infer<typeof listTeamInvitationSchema>

export const teamInvitationListItemSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  inviterId: z.string().uuid(),
  inviteeId: z.string().uuid(),
  type: z.string(),
  status: z.string(),
  message: z.string().nullable(),
  createdAt: z.string().datetime(),
  respondedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime(),
  competitionId: z.string().uuid(),
})

export type TeamInvitationListItem = z.infer<typeof teamInvitationListItemSchema>

// ---------------------------------------------------------------------------
// Action schemas
// ---------------------------------------------------------------------------

export const selectTrackSchema = z.object({
  teamId: z.string().uuid(),
  trackId: z.string().uuid(),
})

export type SelectTrackInput = z.infer<typeof selectTrackSchema>

export const disqualifyTeamSchema = z.object({
  teamId: z.string().uuid(),
  reason: z.string().min(1).max(2000),
})

export type DisqualifyTeamInput = z.infer<typeof disqualifyTeamSchema>

export const reactivateTeamSchema = z.object({
  teamId: z.string().uuid(),
})

export type ReactivateTeamInput = z.infer<typeof reactivateTeamSchema>

export const assignMemberSchema = z.object({
  teamId: z.string().uuid(),
  customerUserId: z.string().uuid(),
  competitionId: z.string().uuid(),
})

export type AssignMemberInput = z.infer<typeof assignMemberSchema>

export const acceptInvitationSchema = z.object({
  invitationId: z.string().uuid(),
})

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>

export const declineInvitationSchema = z.object({
  invitationId: z.string().uuid(),
})

export type DeclineInvitationInput = z.infer<typeof declineInvitationSchema>

export const leaveTeamSchema = z.object({
  teamId: z.string().uuid(),
  competitionId: z.string().uuid(),
})

export type LeaveTeamInput = z.infer<typeof leaveTeamSchema>
