import { z } from 'zod'

// ── JudgePanel ──────────────────────────────────────────────────────
export const judgingRoundValues = ['preliminary', 'final'] as const
export const criterionRoundValues = ['preliminary', 'final', 'both'] as const
export const demoStatusValues = ['queued', 'on_deck', 'presenting', 'qa', 'completed', 'skipped'] as const

export const createPanelSchema = z.object({
  competition_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  round: z.enum(judgingRoundValues).default('preliminary'),
})

export const updatePanelSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  round: z.enum(judgingRoundValues).optional(),
})

// ── Panel Judges/Tracks ──────────────────────────────────────────────
export const addPanelJudgeSchema = z.object({
  panel_id: z.string().uuid(),
  judge_id: z.string().uuid(),
})

export const addPanelTrackSchema = z.object({
  panel_id: z.string().uuid(),
  track_id: z.string().uuid(),
})

// ── JudgingCriterion ────────────────────────────────────────────────
export const createCriterionSchema = z.object({
  competition_id: z.string().uuid(),
  track_id: z.string().uuid().nullable().optional(),
  round: z.enum(criterionRoundValues).default('both'),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  max_score: z.number().int().min(1).default(10),
  weight: z.number().min(0).max(1),
  order: z.number().int().default(0),
})

export const updateCriterionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  max_score: z.number().int().min(1).optional(),
  weight: z.number().min(0).max(1).optional(),
  round: z.enum(criterionRoundValues).optional(),
  order: z.number().int().optional(),
})

// ── ProjectScore (save/submit) ──────────────────────────────────────
export const saveScoreSchema = z.object({
  project_id: z.string().uuid(),
  judge_panel_id: z.string().uuid(),
  competition_id: z.string().uuid(),
  round: z.enum(judgingRoundValues).default('preliminary'),
  comment: z.string().nullable().optional(),
  private_notes: z.string().nullable().optional(),
  conflict_of_interest: z.boolean().default(false),
  is_submitted: z.boolean().default(false),
  criterion_scores: z.array(z.object({
    criterion_id: z.string().uuid(),
    score: z.number().int().min(0),
    note: z.string().nullable().optional(),
  })),
})

// ── DemoSession ─────────────────────────────────────────────────────
export const generateDemoQueueSchema = z.object({
  competition_id: z.string().uuid(),
  round: z.enum(judgingRoundValues).default('preliminary'),
})

export const advanceDemoSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['on_deck', 'presenting', 'qa', 'completed', 'skipped'] as const),
})

export const reorderDemoSchema = z.object({
  id: z.string().uuid(),
  new_order: z.number().int().min(0),
})

// ── Finalists ───────────────────────────────────────────────────────
export const selectFinalistsSchema = z.object({
  competition_id: z.string().uuid(),
  track_id: z.string().uuid(),
  project_ids: z.array(z.string().uuid()),
})

export type CreatePanelInput = z.infer<typeof createPanelSchema>
export type UpdatePanelInput = z.infer<typeof updatePanelSchema>
export type CreateCriterionInput = z.infer<typeof createCriterionSchema>
export type UpdateCriterionInput = z.infer<typeof updateCriterionSchema>
export type SaveScoreInput = z.infer<typeof saveScoreSchema>
export type AdvanceDemoInput = z.infer<typeof advanceDemoSchema>
