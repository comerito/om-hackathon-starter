import { z } from 'zod'

// --- Competition Stage enum for Zod ---

export const competitionStageSchema = z.enum([
  'DRAFT',
  'OPEN',
  'TEAM_FORMATION',
  'TRACK_SELECTION',
  'HACKING',
  'DEMOS',
  'DELIBERATION',
  'FINISHED',
  'ARCHIVED',
])

// --- JSONB config schemas ---

export const stageConfigSchema = z.object({
  allowSimultaneousFormationAndTrack: z.boolean().optional().default(false),
  allowTeamChangesDuringHacking: z.boolean().optional().default(false),
  teamChangeGracePeriodMinutes: z.number().int().positive().nullable().optional(),
  allowSoloParticipants: z.boolean().optional().default(false),
}).default({})

export type StageConfig = z.infer<typeof stageConfigSchema>

export const demoConfigSchema = z.object({
  format: z.string().optional().default('STAGE_PRESENTATION'),
  presentationDurationMinutes: z.number().int().positive().optional().default(3),
  qaDurationMinutes: z.number().int().positive().optional().default(2),
  setupBufferMinutes: z.number().int().positive().optional().default(1),
  finalistsPerTrack: z.number().int().positive().nullable().optional(),
}).default({})

export type DemoConfig = z.infer<typeof demoConfigSchema>

export const judgingConfigSchema = z.object({
  rounds: z.union([z.literal(1), z.literal(2)]).optional().default(1),
  preliminaryJudgesPerProject: z.number().int().positive().optional().default(3),
  finalistsPerTrack: z.number().int().positive().optional().default(3),
  finalRoundFormat: z.string().optional().default('STAGE_PRESENTATION'),
}).default({})

export type JudgingConfig = z.infer<typeof judgingConfigSchema>

export const peerVotingConfigSchema = z.object({
  enabled: z.boolean().optional().default(true),
  votesPerPerson: z.number().int().positive().optional().default(3),
  votingStartsAt: z.coerce.date().nullable().optional(),
  votingEndsAt: z.coerce.date().nullable().optional(),
}).default({})

export type PeerVotingConfig = z.infer<typeof peerVotingConfigSchema>

// --- Create Competition ---

export const createCompetitionSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens only',
  }),
  description: z.string().max(10000).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  timezone: z.string().min(1).max(100).default('Europe/Warsaw'),
  stage: competitionStageSchema.default('DRAFT'),

  // Team constraints
  minTeamSize: z.number().int().min(1).max(100).default(2),
  maxTeamSize: z.number().int().min(1).max(100).default(5),
  maxTeamsPerTrack: z.number().int().positive().nullable().optional(),
  allowTrackChange: z.boolean().default(false),

  // Deadlines
  projectSubmissionDeadline: z.coerce.date().nullable().optional(),
  judgingDeadline: z.coerce.date().nullable().optional(),

  // JSONB configs
  stageConfig: stageConfigSchema.optional(),
  demoConfig: demoConfigSchema.optional(),
  judgingConfig: judgingConfigSchema.optional(),
  peerVotingConfig: peerVotingConfigSchema.optional(),

  // Legal
  codeOfConductUrl: z.string().url().max(2000),
  rulesUrl: z.string().url().max(2000).nullable().optional(),
  privacyPolicyUrl: z.string().url().max(2000).nullable().optional(),

  // Media
  coverImageUrl: z.string().url().max(2000).nullable().optional(),

  // Active flag
  isActive: z.boolean().default(true),
}).refine((data) => data.endsAt > data.startsAt, {
  message: 'endsAt must be after startsAt',
  path: ['endsAt'],
}).refine((data) => data.maxTeamSize >= data.minTeamSize, {
  message: 'maxTeamSize must be greater than or equal to minTeamSize',
  path: ['maxTeamSize'],
})

export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>

// --- Update Competition ---

export const updateCompetitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens only',
  }).optional(),
  description: z.string().max(10000).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  timezone: z.string().min(1).max(100).optional(),
  stage: competitionStageSchema.optional(),

  // Team constraints
  minTeamSize: z.number().int().min(1).max(100).optional(),
  maxTeamSize: z.number().int().min(1).max(100).optional(),
  maxTeamsPerTrack: z.number().int().positive().nullable().optional(),
  allowTrackChange: z.boolean().optional(),

  // Deadlines
  projectSubmissionDeadline: z.coerce.date().nullable().optional(),
  judgingDeadline: z.coerce.date().nullable().optional(),

  // JSONB configs
  stageConfig: stageConfigSchema.optional(),
  demoConfig: demoConfigSchema.optional(),
  judgingConfig: judgingConfigSchema.optional(),
  peerVotingConfig: peerVotingConfigSchema.optional(),

  // Legal
  codeOfConductUrl: z.string().url().max(2000).optional(),
  rulesUrl: z.string().url().max(2000).nullable().optional(),
  privacyPolicyUrl: z.string().url().max(2000).nullable().optional(),

  // Media
  coverImageUrl: z.string().url().max(2000).nullable().optional(),

  // Active flag
  isActive: z.boolean().optional(),
})

export type UpdateCompetitionInput = z.infer<typeof updateCompetitionSchema>

// --- List Competitions ---

export const listCompetitionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().optional(),
  slug: z.string().optional(),
  stage: competitionStageSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  sortField: z.enum(['id', 'name', 'slug', 'stage', 'starts_at', 'ends_at', 'created_at']).optional().default('created_at'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
})

export type ListCompetitionQuery = z.infer<typeof listCompetitionSchema>

// --- Competition List Item (OpenAPI response shape) ---

export const competitionListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string(),
  stage: competitionStageSchema,
  minTeamSize: z.number(),
  maxTeamSize: z.number(),
  maxTeamsPerTrack: z.number().nullable(),
  allowTrackChange: z.boolean(),
  projectSubmissionDeadline: z.string().datetime().nullable(),
  judgingDeadline: z.string().datetime().nullable(),
  stageConfig: stageConfigSchema,
  demoConfig: demoConfigSchema,
  judgingConfig: judgingConfigSchema,
  peerVotingConfig: peerVotingConfigSchema,
  codeOfConductUrl: z.string(),
  rulesUrl: z.string().nullable(),
  privacyPolicyUrl: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type CompetitionListItem = z.infer<typeof competitionListItemSchema>

// ==========================================================================
// Participation Validators
// ==========================================================================

export const participationRoleSchema = z.enum(['participant', 'mentor', 'judge'])

export type ParticipationRoleValue = z.infer<typeof participationRoleSchema>

// --- Create Participation ---

export const createParticipationSchema = z.object({
  competitionId: z.string().uuid(),
  customerUserId: z.string().uuid(),
  role: participationRoleSchema.default('participant'),
})

export type CreateParticipationInput = z.infer<typeof createParticipationSchema>

// --- Update Participation ---

export const updateParticipationSchema = z.object({
  id: z.string().uuid(),
  cocAccepted: z.boolean().optional(),
  privacyPolicyAccepted: z.boolean().optional(),
  lookingForTeam: z.boolean().optional(),
  lookingForTeamDescription: z.string().max(2000).nullable().optional(),
  profileComplete: z.boolean().optional(),
})

export type UpdateParticipationInput = z.infer<typeof updateParticipationSchema>

// --- List Participations ---

export const listParticipationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  sortField: z.string().optional().default('created_at'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  competitionId: z.string().uuid().optional(),
  role: participationRoleSchema.optional(),
  checkedIn: z.coerce.boolean().optional(),
  cocAccepted: z.coerce.boolean().optional(),
  lookingForTeam: z.coerce.boolean().optional(),
})

export type ListParticipationQuery = z.infer<typeof listParticipationSchema>

// --- Participation List Item (OpenAPI response shape) ---

export const participationListItemSchema = z.object({
  id: z.string().uuid(),
  competitionId: z.string().uuid(),
  customerUserId: z.string().uuid(),
  role: participationRoleSchema,
  checkedIn: z.boolean(),
  checkedInAt: z.string().datetime().nullable(),
  badgePrinted: z.boolean(),
  cocAccepted: z.boolean(),
  cocAcceptedAt: z.string().datetime().nullable(),
  privacyPolicyAccepted: z.boolean(),
  privacyPolicyAcceptedAt: z.string().datetime().nullable(),
  profileComplete: z.boolean(),
  lookingForTeam: z.boolean(),
  lookingForTeamDescription: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type ParticipationListItem = z.infer<typeof participationListItemSchema>

// ==========================================================================
// ParticipantProfile Validators
// ==========================================================================

export const socialLinksSchema = z.object({
  github: z.string().url().optional(),
  linkedin: z.string().url().optional(),
  twitter: z.string().url().optional(),
  website: z.string().url().optional(),
}).default({})

export type SocialLinks = z.infer<typeof socialLinksSchema>

// --- Create Profile ---

export const createProfileSchema = z.object({
  customerUserId: z.string().uuid(),
  bio: z.string().max(5000).nullable().optional(),
  organization: z.string().max(255).nullable().optional(),
  skills: z.array(z.string().max(100)).max(50).optional().default([]),
  socialLinks: socialLinksSchema.optional(),
})

export type CreateProfileInput = z.infer<typeof createProfileSchema>

// --- Update Profile ---

export const updateProfileSchema = z.object({
  id: z.string().uuid(),
  bio: z.string().max(5000).nullable().optional(),
  organization: z.string().max(255).nullable().optional(),
  skills: z.array(z.string().max(100)).max(50).optional(),
  socialLinks: socialLinksSchema.optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

// --- List Profiles ---

export const listProfileSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  skills: z.string().optional(),
  organization: z.string().optional(),
})

export type ListProfileQuery = z.infer<typeof listProfileSchema>

// ==========================================================================
// Bulk Import
// ==========================================================================

export const bulkImportItemSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  role: participationRoleSchema.default('participant'),
  organization: z.string().max(255).optional(),
})

export const bulkImportSchema = z.array(bulkImportItemSchema)

export type BulkImportItem = z.infer<typeof bulkImportItemSchema>
