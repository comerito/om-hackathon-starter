import { z } from 'zod'
import { locales } from '@open-mercato/shared/lib/i18n/config'

export const portalLocaleEnum = z.enum(locales as [typeof locales[number], ...typeof locales[number][]])

// ── Shared start/end ordering validation ────────────────────────────

export const TIME_RANGE_MESSAGE = 'End time must be after the start time'

/**
 * True when `end` is strictly after `start`.
 *
 * Equality is rejected on purpose: a zero-length agenda slot (or competition) is never
 * something an organiser means to create, and the participant timeline renders it as an
 * empty block, so it is just as broken as an inverted range.
 *
 * Returns `true` — i.e. "nothing to report here" — whenever the pair cannot be judged
 * (either side absent, not a string, or unparseable). Those cases belong to the per-field
 * `datetime()` / `required` checks, and reporting them twice would attach a confusing
 * ordering error to a field whose real problem is its format.
 */
export function isOrderedTimeRange(start: unknown, end: unknown): boolean {
  if (typeof start !== 'string' || typeof end !== 'string') return true
  if (!start || !end) return true
  const startMs = Date.parse(start)
  const endMs = Date.parse(end)
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return true
  return endMs > startMs
}

/**
 * Builds a `superRefine` check that enforces `end > start` and attaches the issue to the
 * END field, so `CrudForm` renders it under the input the user has to change.
 *
 * On the `update*` schemas both keys are optional, so the check only fires when the caller
 * sends both halves. A partial update that moves only one edge past the other is caught by
 * the command handler, which can compare against the persisted row.
 */
function timeRangeCheck(startKey: string, endKey: string) {
  return (value: unknown, ctx: z.RefinementCtx): void => {
    const record = (value ?? {}) as Record<string, unknown>
    if (isOrderedTimeRange(record[startKey], record[endKey])) return
    ctx.addIssue({ code: 'custom', message: TIME_RANGE_MESSAGE, path: [endKey] })
  }
}

const startsEndsOrdered = timeRangeCheck('starts_at', 'ends_at')

export const portalLocaleSchema = z.object({
  locale: portalLocaleEnum,
})

export const portalDefaultLocaleSchema = z.object({
  default_locale: portalLocaleEnum,
})

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
  code_of_conduct_content: z.preprocess(v => (v === '' ? null : v), z.string().nullable().optional()),
  rules_url: z.preprocess(v => (v === '' ? null : v), z.string().url().max(1000).nullable().optional()),
  rules_content: z.preprocess(v => (v === '' ? null : v), z.string().nullable().optional()),
  privacy_policy_url: z.preprocess(v => (v === '' ? null : v), z.string().url().max(1000).nullable().optional()),
  privacy_policy_content: z.preprocess(v => (v === '' ? null : v), z.string().nullable().optional()),
  cover_image_url: z.preprocess(v => (v === '' ? null : v), z.string().url().max(1000).nullable().optional()),
}).superRefine(startsEndsOrdered)

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
  code_of_conduct_content: z.preprocess(v => (v === '' ? null : v), z.string().nullable().optional()),
  rules_url: z.preprocess(v => (v === '' ? null : v), z.string().url().max(1000).nullable().optional()),
  rules_content: z.preprocess(v => (v === '' ? null : v), z.string().nullable().optional()),
  privacy_policy_url: z.preprocess(v => (v === '' ? null : v), z.string().url().max(1000).nullable().optional()),
  privacy_policy_content: z.preprocess(v => (v === '' ? null : v), z.string().nullable().optional()),
  cover_image_url: z.preprocess(v => (v === '' ? null : v), z.string().url().max(1000).nullable().optional()),
}).superRefine(startsEndsOrdered)

export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>
export type UpdateCompetitionInput = z.infer<typeof updateCompetitionSchema>

// ── CompetitionInfoCard ────────────────────────────────────────────

export const createCompetitionInfoCardSchema = z.object({
  competition_id: z.string().uuid(),
  key: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/, 'Key must be lowercase alphanumeric with underscores or hyphens'),
  icon: z.string().max(100).optional(),
  label: z.string().min(1).max(255),
  value: z.string().min(1),
  sort_order: z.number().int().default(0),
})

export const updateCompetitionInfoCardSchema = z.object({
  id: z.string().uuid(),
  competition_id: z.string().uuid().optional(),
  key: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/).optional(),
  icon: z.string().max(100).nullable().optional(),
  label: z.string().min(1).max(255).optional(),
  value: z.string().min(1).optional(),
  sort_order: z.number().int().optional(),
})

export type CreateCompetitionInfoCardInput = z.infer<typeof createCompetitionInfoCardSchema>
export type UpdateCompetitionInfoCardInput = z.infer<typeof updateCompetitionInfoCardSchema>

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
}).superRefine(startsEndsOrdered)

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
}).superRefine(startsEndsOrdered)

export type CreateAgendaItemInput = z.infer<typeof createAgendaItemSchema>
export type UpdateAgendaItemInput = z.infer<typeof updateAgendaItemSchema>

/**
 * Client-side schema for the backoffice agenda forms (create + edit).
 *
 * Wiring this into `CrudForm` is what makes an inverted range show up as a field-level error
 * on "End Time" instead of only failing on the server. It declares just the two fields the
 * cross-field rule needs — `looseObject` keeps every other key (`id`, `competition_id`,
 * custom fields, the edit page's initial values) so parsing the form never drops data from
 * the submitted payload — and no `.default()` / `.transform()`, so its input and output
 * types match, which `CrudForm` requires.
 */
export const agendaItemFormSchema = z.looseObject({
  starts_at: z.string().min(1),
  ends_at: z.string().min(1),
}).superRefine(startsEndsOrdered)

// ── Announcement ────────────────────────────────────────────────────

export const announcementPriorityValues = ['info', 'warning', 'urgent'] as const
export const announcementCategoryValues = ['general', 'logistics', 'technical', 'schedule', 'judging'] as const

export const createAnnouncementSchema = z.object({
  competition_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  priority: z.enum(announcementPriorityValues).default('info'),
  category: z.enum(announcementCategoryValues).default('general'),
  action_url: z.string().url().max(1000).nullable().optional(),
  action_label: z.string().max(255).nullable().optional(),
  target_roles: z.array(z.string()).default([]),
  target_track_ids: z.array(z.string().uuid()).default([]),
  pinned: z.boolean().default(false),
})

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>

export const updateAnnouncementSchema = z.object({
  id: z.string().uuid(),
  competition_id: z.string().uuid().optional(),
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  priority: z.enum(announcementPriorityValues).optional(),
  category: z.enum(announcementCategoryValues).optional(),
  action_url: z.string().url().max(1000).nullable().optional(),
  action_label: z.string().max(255).nullable().optional(),
  target_roles: z.array(z.string()).optional(),
  target_track_ids: z.array(z.string().uuid()).optional(),
  pinned: z.boolean().optional(),
})

export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>

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
}).superRefine(startsEndsOrdered)

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
