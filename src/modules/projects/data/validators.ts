import { z } from 'zod'

// ── Project ──────────────────────────────────────────────────────────

export const projectStatusValues = ['draft', 'published', 'under_review', 'scored'] as const

export const createProjectSchema = z.object({
  team_id: z.string().uuid(),
  competition_id: z.string().uuid(),
  track_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  tagline: z.string().max(140).optional(),
  description: z.string().optional(),
  problem_statement: z.string().optional(),
  solution: z.string().optional(),
  tech_stack: z.array(z.string()).default([]),
  demo_url: z.string().url().max(1000).optional().or(z.literal('')),
  repo_url: z.string().url().max(1000).optional().or(z.literal('')),
  video_url: z.string().url().max(1000).optional().or(z.literal('')),
  presentation_url: z.string().url().max(1000).optional().or(z.literal('')),
  screenshot_ids: z.array(z.string().uuid()).default([]),
  attachment_ids: z.array(z.string().uuid()).default([]),
  uses_preexisting_code: z.boolean().default(false),
  preexisting_code_description: z.string().optional(),
  built_during_hackathon_description: z.string().optional(),
})

export const updateProjectSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  tagline: z.string().max(140).nullable().optional(),
  description: z.string().nullable().optional(),
  problem_statement: z.string().nullable().optional(),
  solution: z.string().nullable().optional(),
  tech_stack: z.array(z.string()).optional(),
  demo_url: z.string().url().max(1000).nullable().optional().or(z.literal('')),
  repo_url: z.string().url().max(1000).nullable().optional().or(z.literal('')),
  video_url: z.string().url().max(1000).nullable().optional().or(z.literal('')),
  presentation_url: z.string().url().max(1000).nullable().optional().or(z.literal('')),
  screenshot_ids: z.array(z.string().uuid()).optional(),
  attachment_ids: z.array(z.string().uuid()).optional(),
  uses_preexisting_code: z.boolean().optional(),
  preexisting_code_description: z.string().nullable().optional(),
  built_during_hackathon_description: z.string().nullable().optional(),
})

export const flagProjectSchema = z.object({
  id: z.string().uuid(),
  flagged_reason: z.string().min(1),
})

export const submitProjectSchema = z.object({
  id: z.string().uuid(),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type FlagProjectInput = z.infer<typeof flagProjectSchema>
