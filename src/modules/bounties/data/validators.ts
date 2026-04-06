import { z } from 'zod'

// ── Enums ─────────────��──────────────────────────────────────────────

export const bountyPRStatusValues = [
  'detected', 'classified', 'pending_review', 'approved', 'rejected', 'duplicate',
] as const

export const bountyCategoryValues = [
  'critical_bug_fix', 'regular_bug_fix', 'new_improved_test', 'documentation_improvement', 'minor_fix',
] as const

// ── Shared Schemas ───────────────────────────────────────────────────

const classificationItemSchema = z.object({
  category: z.enum(bountyCategoryValues),
  reasoning: z.string().min(1),
})

// ── LLM Output Schemas ─────────��────────────────────────────────────

export const classificationResultSchema = z.object({
  classifications: z.array(
    z.object({
      category: z.enum(bountyCategoryValues),
      reasoning: z.string().describe('Brief explanation of why this category was assigned'),
    })
  ).describe('One or more categories this PR falls into. A single PR can match multiple categories.'),
  confidence: z.number().min(0).max(1).describe('Overall confidence in the classification (0.0 to 1.0). Below 0.7 flags for judge review.'),
  summary: z.string().describe('One-sentence summary of what this PR does'),
})

export const duplicateCheckResultSchema = z.object({
  is_duplicate: z.boolean().describe('Whether this PR resolves the same problem as an existing PR'),
  duplicate_of_pr_number: z.number().nullable().describe('The PR number this is a duplicate of, or null'),
  similarity: z.number().min(0).max(1).describe('Semantic similarity score (0.0 = unrelated, 1.0 = identical fix)'),
  reasoning: z.string().describe('Explanation of why this is or is not a duplicate'),
})

export type ClassificationResult = z.infer<typeof classificationResultSchema>
export type DuplicateCheckResult = z.infer<typeof duplicateCheckResultSchema>

// ── API Request Schemas ────────────��─────────────────────────────────

export const listBountyPRsQuerySchema = z.object({
  competition_id: z.string().uuid(),
  status: z.enum(bountyPRStatusValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sort: z.string().optional(),
})

export const approvePRSchema = z.object({
  id: z.string().uuid(),
})

export const rejectPRSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().optional(),
})

export const overrideClassificationSchema = z.object({
  id: z.string().uuid(),
  classifications: z.array(classificationItemSchema).min(1),
})

export const markDuplicateSchema = z.object({
  id: z.string().uuid(),
  duplicate_of_id: z.string().uuid(),
  reason: z.string().optional(),
})

export const adjustPointsSchema = z.object({
  id: z.string().uuid(),
  total_points: z.number().int().min(0),
  reason: z.string().min(1),
})

export const leaderboardQuerySchema = z.object({
  competition_id: z.string().uuid(),
})

export const activityQuerySchema = z.object({
  competition_id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const manualPollSchema = z.object({
  competition_id: z.string().uuid(),
})

export const registerGithubUsernameSchema = z.object({
  github_username: z.string().min(1).max(39).regex(
    /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i,
    'Invalid GitHub username format'
  ),
})

// ── Types ─────────────��──────────────────────────────────────────────

export type ListBountyPRsQuery = z.infer<typeof listBountyPRsQuerySchema>
export type ApprovePRInput = z.infer<typeof approvePRSchema>
export type RejectPRInput = z.infer<typeof rejectPRSchema>
export type OverrideClassificationInput = z.infer<typeof overrideClassificationSchema>
export type MarkDuplicateInput = z.infer<typeof markDuplicateSchema>
export type AdjustPointsInput = z.infer<typeof adjustPointsSchema>
export type RegisterGithubUsernameInput = z.infer<typeof registerGithubUsernameSchema>
