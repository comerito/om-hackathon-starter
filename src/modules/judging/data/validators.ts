import { z } from 'zod'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const judgingRoundSchema = z.enum(['PRELIMINARY', 'FINAL'])
export const criterionRoundSchema = z.enum(['PRELIMINARY', 'FINAL', 'BOTH'])
export const demoStatusSchema = z.enum(['QUEUED', 'ON_DECK', 'PRESENTING', 'QA', 'COMPLETED', 'SKIPPED'])

// ---------------------------------------------------------------------------
// JudgePanel
// ---------------------------------------------------------------------------

export const createPanelSchema = z.object({
  competitionId: z.string().uuid(),
  name: z.string().min(1).max(255),
  round: judgingRoundSchema.default('PRELIMINARY'),
})
export type CreatePanelInput = z.infer<typeof createPanelSchema>

export const updatePanelSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  round: judgingRoundSchema.optional(),
})
export type UpdatePanelInput = z.infer<typeof updatePanelSchema>

export const listPanelSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  sortField: z.string().optional().default('name'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
  competitionId: z.string().uuid().optional(),
  round: judgingRoundSchema.optional(),
})
export type ListPanelQuery = z.infer<typeof listPanelSchema>

// ---------------------------------------------------------------------------
// Panel Judge / Track management
// ---------------------------------------------------------------------------

export const addPanelJudgeSchema = z.object({
  panelId: z.string().uuid(),
  judgeId: z.string().uuid(),
})
export type AddPanelJudgeInput = z.infer<typeof addPanelJudgeSchema>

export const removePanelJudgeSchema = z.object({
  panelId: z.string().uuid(),
  judgeId: z.string().uuid(),
})
export type RemovePanelJudgeInput = z.infer<typeof removePanelJudgeSchema>

export const addPanelTrackSchema = z.object({
  panelId: z.string().uuid(),
  trackId: z.string().uuid(),
})
export type AddPanelTrackInput = z.infer<typeof addPanelTrackSchema>

export const removePanelTrackSchema = z.object({
  panelId: z.string().uuid(),
  trackId: z.string().uuid(),
})
export type RemovePanelTrackInput = z.infer<typeof removePanelTrackSchema>

// ---------------------------------------------------------------------------
// JudgingCriterion
// ---------------------------------------------------------------------------

export const createCriterionSchema = z.object({
  competitionId: z.string().uuid(),
  trackId: z.string().uuid().nullable().optional(),
  round: criterionRoundSchema.default('BOTH'),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  maxScore: z.number().int().min(1).max(100).default(10),
  weight: z.number().min(0).max(1),
  order: z.number().int().min(0).default(0),
})
export type CreateCriterionInput = z.infer<typeof createCriterionSchema>

export const updateCriterionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  maxScore: z.number().int().min(1).max(100).optional(),
  weight: z.number().min(0).max(1).optional(),
  order: z.number().int().min(0).optional(),
  round: criterionRoundSchema.optional(),
  trackId: z.string().uuid().nullable().optional(),
})
export type UpdateCriterionInput = z.infer<typeof updateCriterionSchema>

export const listCriterionSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  sortField: z.string().optional().default('order'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
  competitionId: z.string().uuid().optional(),
  trackId: z.string().uuid().nullable().optional(),
  round: criterionRoundSchema.optional(),
})
export type ListCriterionQuery = z.infer<typeof listCriterionSchema>

// ---------------------------------------------------------------------------
// Score submission
// ---------------------------------------------------------------------------

export const criterionScoreInputSchema = z.object({
  criterionId: z.string().uuid(),
  score: z.number().int().min(0),
  note: z.string().max(2000).nullable().optional(),
})

export const submitScoreSchema = z.object({
  projectId: z.string().uuid(),
  round: judgingRoundSchema,
  judgePanelId: z.string().uuid(),
  competitionId: z.string().uuid(),
  criterionScores: z.array(criterionScoreInputSchema).min(1),
  comment: z.string().max(5000).nullable().optional(),
  privateNotes: z.string().max(5000).nullable().optional(),
  conflictOfInterest: z.boolean().default(false),
  isSubmitted: z.boolean().default(false),
})
export type SubmitScoreInput = z.infer<typeof submitScoreSchema>

export const listScoreSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  competitionId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  judgeId: z.string().uuid().optional(),
  round: judgingRoundSchema.optional(),
  isSubmitted: z.coerce.boolean().optional(),
})
export type ListScoreQuery = z.infer<typeof listScoreSchema>

// ---------------------------------------------------------------------------
// Scoring progress
// ---------------------------------------------------------------------------

export const scoringProgressSchema = z.object({
  competitionId: z.string().uuid(),
  round: judgingRoundSchema.optional(),
})
export type ScoringProgressQuery = z.infer<typeof scoringProgressSchema>

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export const leaderboardSchema = z.object({
  competitionId: z.string().uuid(),
  trackId: z.string().uuid().optional(),
  round: judgingRoundSchema.optional(),
})
export type LeaderboardQuery = z.infer<typeof leaderboardSchema>

// ---------------------------------------------------------------------------
// Finalists
// ---------------------------------------------------------------------------

export const selectFinalistsSchema = z.object({
  competitionId: z.string().uuid(),
  projectIds: z.array(z.string().uuid()).min(1),
})
export type SelectFinalistsInput = z.infer<typeof selectFinalistsSchema>

// ---------------------------------------------------------------------------
// DemoSession
// ---------------------------------------------------------------------------

export const generateQueueSchema = z.object({
  competitionId: z.string().uuid(),
  round: judgingRoundSchema,
})
export type GenerateQueueInput = z.infer<typeof generateQueueSchema>

export const listDemoSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  competitionId: z.string().uuid().optional(),
  round: judgingRoundSchema.optional(),
  status: demoStatusSchema.optional(),
  sortField: z.string().optional().default('presentation_order'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
})
export type ListDemoQuery = z.infer<typeof listDemoSchema>

export const advanceDemoSchema = z.object({
  demoId: z.string().uuid(),
})
export type AdvanceDemoInput = z.infer<typeof advanceDemoSchema>

export const skipDemoSchema = z.object({
  demoId: z.string().uuid(),
})
export type SkipDemoInput = z.infer<typeof skipDemoSchema>

// ---------------------------------------------------------------------------
// List items (OpenAPI documentation)
// ---------------------------------------------------------------------------

export const panelListItemSchema = z.object({
  id: z.string().uuid(),
  competitionId: z.string().uuid(),
  name: z.string(),
  round: judgingRoundSchema,
  createdAt: z.string().datetime(),
})

export const criterionListItemSchema = z.object({
  id: z.string().uuid(),
  competitionId: z.string().uuid(),
  trackId: z.string().uuid().nullable(),
  round: criterionRoundSchema,
  name: z.string(),
  description: z.string().nullable(),
  maxScore: z.number(),
  weight: z.number(),
  order: z.number(),
  createdAt: z.string().datetime(),
})

export const projectScoreListItemSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  judgeId: z.string().uuid(),
  judgePanelId: z.string().uuid(),
  round: judgingRoundSchema,
  totalScore: z.number().nullable(),
  comment: z.string().nullable(),
  conflictOfInterest: z.boolean(),
  isSubmitted: z.boolean(),
  submittedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

export const demoSessionListItemSchema = z.object({
  id: z.string().uuid(),
  competitionId: z.string().uuid(),
  teamId: z.string().uuid(),
  projectId: z.string().uuid(),
  trackId: z.string().uuid(),
  presentationOrder: z.number(),
  scheduledStart: z.string().datetime().nullable(),
  presentationDurationMinutes: z.number(),
  qaDurationMinutes: z.number(),
  status: demoStatusSchema,
  actualStart: z.string().datetime().nullable(),
  actualEnd: z.string().datetime().nullable(),
  round: judgingRoundSchema,
  createdAt: z.string().datetime(),
})
