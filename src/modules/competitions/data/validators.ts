import { z } from 'zod'

// ── JSONB config schemas ────────────────────────────────────────────

export const stageConfigSchema = z.object({
  allowSimultaneousFormationAndTrack: z.boolean().default(false),
  allowTeamChangesDuringHacking: z.boolean().default(false),
  teamChangeGracePeriodMinutes: z.number().nullable().default(null),
  allowSoloParticipants: z.boolean().default(false),
})

export const demoConfigSchema = z.object({
  format: z.literal('stage_presentation').default('stage_presentation'),
  presentationDurationMinutes: z.number().int().min(1).default(3),
  qaDurationMinutes: z.number().int().min(0).default(2),
  setupBufferMinutes: z.number().int().min(0).default(1),
  finalistsPerTrack: z.number().int().nullable().default(null),
})

export const judgingConfigSchema = z.object({
  rounds: z.union([z.literal(1), z.literal(2)]).default(1),
  preliminaryJudgesPerProject: z.number().int().min(1).default(3),
  finalistsPerTrack: z.number().int().min(1).default(3),
  preliminaryWeight: z.number().min(0).max(1).default(0.4),
  finalWeight: z.number().min(0).max(1).default(0.6),
  projectDistribution: z.enum(['all', 'distributed']).default('all'),
  finalRoundFormat: z.literal('stage_presentation').default('stage_presentation'),
})

export const peerVotingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  votesPerPerson: z.number().int().min(1).default(3),
  votingStartsAt: z.string().nullable().default(null),
  votingEndsAt: z.string().nullable().default(null),
  allowVoteChange: z.boolean().default(false),
})

// ── Competition ─────────────────────────────────────────────────────

export const competitionStageValues = [
  'draft', 'open', 'team_formation', 'track_selection',
  'hacking', 'demos', 'deliberation', 'finished', 'archived',
] as const

export const createCompetitionSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().optional(),
  location: z.string().max(500).optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  timezone: z.string().max(50).default('Europe/Warsaw'),
  min_team_size: z.number().int().min(1).default(2),
  max_team_size: z.number().int().min(1).default(5),
  max_teams_per_track: z.number().int().min(1).optional(),
  max_tracks_per_team: z.number().int().min(1).default(1),
  allow_track_change: z.boolean().default(false),
  project_submission_deadline: z.string().datetime().optional(),
  judging_deadline: z.string().datetime().optional(),
  stage_config: stageConfigSchema.optional(),
  demo_config: demoConfigSchema.optional(),
  judging_config: judgingConfigSchema.optional(),
  peer_voting_config: peerVotingConfigSchema.optional(),
  code_of_conduct_url: z.string().url().max(1000),
  rules_url: z.string().url().max(1000).optional(),
  privacy_policy_url: z.string().url().max(1000).optional(),
  cover_image_url: z.string().url().max(1000).optional(),
})

export const updateCompetitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().optional(),
  location: z.string().max(500).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  timezone: z.string().max(50).optional(),
  min_team_size: z.number().int().min(1).optional(),
  max_team_size: z.number().int().min(1).optional(),
  max_teams_per_track: z.number().int().min(1).nullable().optional(),
  max_tracks_per_team: z.number().int().min(1).optional(),
  allow_track_change: z.boolean().optional(),
  project_submission_deadline: z.string().datetime().nullable().optional(),
  judging_deadline: z.string().datetime().nullable().optional(),
  stage_config: stageConfigSchema.optional(),
  demo_config: demoConfigSchema.optional(),
  judging_config: judgingConfigSchema.optional(),
  peer_voting_config: peerVotingConfigSchema.optional(),
  code_of_conduct_url: z.string().url().max(1000).optional(),
  rules_url: z.preprocess(v => (v === '' ? null : v), z.string().url().max(1000).nullable().optional()),
  privacy_policy_url: z.preprocess(v => (v === '' ? null : v), z.string().url().max(1000).nullable().optional()),
  cover_image_url: z.preprocess(v => (v === '' ? null : v), z.string().url().max(1000).nullable().optional()),
  info_cards: z.any().optional(),
})

export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>
export type UpdateCompetitionInput = z.infer<typeof updateCompetitionSchema>

// ── Stage Advance ───────────────────────────────────────────────────

export const advanceStageSchema = z.object({
  target_stage: z.enum(competitionStageValues),
})

export type AdvanceStageInput = z.infer<typeof advanceStageSchema>

// ── CompetitionParticipation ────────────────────────────────────────

export const participationRoleValues = ['participant', 'mentor', 'judge'] as const

export const createParticipationSchema = z.object({
  competition_id: z.string().uuid(),
  customer_user_id: z.string().uuid(),
  role: z.enum(participationRoleValues).default('participant'),
})

export const updateParticipationSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(participationRoleValues).optional(),
  checked_in: z.boolean().optional(),
  coc_accepted: z.boolean().optional(),
  privacy_policy_accepted: z.boolean().optional(),
  looking_for_team: z.boolean().optional(),
  looking_for_team_description: z.string().nullable().optional(),
  profile_complete: z.boolean().optional(),
})

export type CreateParticipationInput = z.infer<typeof createParticipationSchema>
export type UpdateParticipationInput = z.infer<typeof updateParticipationSchema>

// ── AgendaItem ──────────────────────────────────────────────────────

export const agendaItemTypeValues = [
  'ceremony', 'talk', 'workshop', 'break', 'meal', 'deadline', 'demo_session', 'custom',
] as const

export const createAgendaItemSchema = z.object({
  competition_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum(agendaItemTypeValues).default('custom'),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  location: z.string().max(255).optional(),
  speaker_name: z.string().max(255).optional(),
  speaker_bio: z.string().optional(),
  speaker_photo_url: z.string().max(1000).optional(),
  track_id: z.string().uuid().optional(),
  is_mandatory: z.boolean().default(false),
  order: z.number().int().default(0),
})

export const updateAgendaItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  type: z.enum(agendaItemTypeValues).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  location: z.string().max(255).nullable().optional(),
  speaker_name: z.string().max(255).nullable().optional(),
  speaker_bio: z.string().nullable().optional(),
  speaker_photo_url: z.string().max(1000).nullable().optional(),
  track_id: z.string().uuid().nullable().optional(),
  is_mandatory: z.boolean().optional(),
  order: z.number().int().optional(),
})

export type CreateAgendaItemInput = z.infer<typeof createAgendaItemSchema>
export type UpdateAgendaItemInput = z.infer<typeof updateAgendaItemSchema>

// ── Announcement ────────────────────────────────────────────────────

export const announcementPriorityValues = ['info', 'warning', 'urgent'] as const

export const createAnnouncementSchema = z.object({
  competition_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  priority: z.enum(announcementPriorityValues).default('info'),
  target_roles: z.array(z.string()).default([]),
  target_track_ids: z.array(z.string().uuid()).default([]),
  pinned: z.boolean().default(false),
})

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>

// ── Milestone ────────────────────────────────────────────────────────

export const milestoneStatusValues = ['upcoming', 'active', 'completed'] as const

// Preprocess to convert datetime-local ("2026-03-23T23:00") to ISO
const toIsoDate = z.preprocess(
  (v) => { if (typeof v === 'string' && v && !v.endsWith('Z')) { try { return new Date(v).toISOString() } catch { return v } } return v },
  z.string().datetime(),
)

export const createMilestoneSchema = z.object({
  competition_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  due_date: toIsoDate,
  status: z.enum(milestoneStatusValues).default('upcoming'),
  sort_order: z.number().int().default(0),
})

export const updateMilestoneSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  due_date: toIsoDate.optional(),
  status: z.enum(milestoneStatusValues).optional(),
  sort_order: z.number().int().optional(),
})

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>

// ── Bulk Import Agenda ──────────────────────────────────────────────

export const bulkAgendaItemRowSchema = z.object({
  title: z.string().min(1).max(255),
  type: z.enum(agendaItemTypeValues).default('custom'),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  description: z.string().optional(),
  location: z.string().max(255).optional(),
  speaker_name: z.string().max(255).optional(),
  speaker_bio: z.string().optional(),
  is_mandatory: z.preprocess(v => v === 'true' || v === '1' || v === true, z.boolean()).default(false),
  order: z.preprocess(v => (typeof v === 'string' && v !== '' ? parseInt(v, 10) : v), z.number().int()).default(0),
})

export const bulkAgendaImportSchema = z.object({
  competition_id: z.string().uuid(),
  items: z.array(bulkAgendaItemRowSchema).min(1).max(200),
})

export type BulkAgendaItemRow = z.infer<typeof bulkAgendaItemRowSchema>
export type BulkAgendaImportInput = z.infer<typeof bulkAgendaImportSchema>

// ── Bulk Import Milestones ──────────────────────────────────────────

export const bulkMilestoneRowSchema = z.object({
  name: z.string().min(1).max(255),
  due_date: toIsoDate,
  description: z.string().optional(),
  status: z.enum(milestoneStatusValues).default('upcoming'),
  sort_order: z.preprocess(v => (typeof v === 'string' && v !== '' ? parseInt(v, 10) : v), z.number().int()).default(0),
})

export const bulkMilestoneImportSchema = z.object({
  competition_id: z.string().uuid(),
  items: z.array(bulkMilestoneRowSchema).min(1).max(100),
})

export type BulkMilestoneRow = z.infer<typeof bulkMilestoneRowSchema>
export type BulkMilestoneImportInput = z.infer<typeof bulkMilestoneImportSchema>

// ── Bulk Invite ─────────────────────────────────────────────────────

export const bulkInviteRowSchema = z.object({
  email: z.string().email().max(255),
  display_name: z.string().min(1).max(255),
  role: z.enum(participationRoleValues).default('participant'),
})

export const bulkInviteSchema = z.object({
  competition_id: z.string().uuid(),
  org_slug: z.string().min(1).max(255),
  invitees: z.array(bulkInviteRowSchema).min(1).max(500),
})

export type BulkInviteRow = z.infer<typeof bulkInviteRowSchema>
export type BulkInviteInput = z.infer<typeof bulkInviteSchema>
