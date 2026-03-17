import { z } from 'zod'

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export const createProjectSchema = z.object({
  teamId: z.string().uuid(),
  competitionId: z.string().uuid(),
  trackId: z.string().uuid(),
  title: z.string().min(1).max(255),
  tagline: z.string().max(140).nullable().optional(),
  description: z.string().max(10000).nullable().optional(),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export const updateProjectSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  tagline: z.string().max(140).nullable().optional(),
  description: z.string().max(10000).nullable().optional(),
  problemStatement: z.string().max(10000).nullable().optional(),
  solution: z.string().max(10000).nullable().optional(),
  techStack: z.array(z.string().max(100)).max(20).optional(),
  demoUrl: z.string().url().max(2000).nullable().optional(),
  repoUrl: z.string().url().max(2000).nullable().optional(),
  videoUrl: z.string().url().max(2000).nullable().optional(),
  presentationUrl: z.string().url().max(2000).nullable().optional(),
  screenshotIds: z.array(z.string().uuid()).max(10).optional(),
  attachmentIds: z.array(z.string().uuid()).max(10).optional(),
  usesPreexistingCode: z.boolean().optional(),
  preexistingCodeDescription: z.string().max(5000).nullable().optional(),
  builtDuringHackathonDescription: z.string().max(5000).nullable().optional(),
  trackId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>

// ---------------------------------------------------------------------------
// Submit — validates required fields for submission
// ---------------------------------------------------------------------------

export const submitProjectSchema = z
  .object({
    projectId: z.string().uuid(),
  })

export type SubmitProjectInput = z.infer<typeof submitProjectSchema>

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export const listProjectSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  sortField: z.string().optional().default('title'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
  competitionId: z.string().uuid().optional(),
  trackId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'UNDER_REVIEW', 'SCORED']).optional(),
  teamId: z.string().uuid().optional(),
  flaggedForReuse: z.coerce.boolean().optional(),
})

export type ListProjectQuery = z.infer<typeof listProjectSchema>

// ---------------------------------------------------------------------------
// Flag
// ---------------------------------------------------------------------------

export const flagProjectSchema = z.object({
  projectId: z.string().uuid(),
  reason: z.string().min(1).max(2000),
})

export type FlagProjectInput = z.infer<typeof flagProjectSchema>

// ---------------------------------------------------------------------------
// Unflag
// ---------------------------------------------------------------------------

export const unflagProjectSchema = z.object({
  projectId: z.string().uuid(),
})

export type UnflagProjectInput = z.infer<typeof unflagProjectSchema>

// ---------------------------------------------------------------------------
// List item (OpenAPI)
// ---------------------------------------------------------------------------

export const projectListItemSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  competitionId: z.string().uuid(),
  trackId: z.string().uuid(),
  title: z.string(),
  tagline: z.string().nullable(),
  description: z.string().nullable(),
  status: z.string(),
  flaggedForReuse: z.boolean(),
  submittedAt: z.string().datetime().nullable(),
  techStack: z.array(z.string()),
  demoUrl: z.string().nullable(),
  repoUrl: z.string().nullable(),
  videoUrl: z.string().nullable(),
  presentationUrl: z.string().nullable(),
  usesPreexistingCode: z.boolean(),
  finalScore: z.number().nullable(),
  peerVoteCount: z.number().nullable(),
  rank: z.number().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type ProjectListItem = z.infer<typeof projectListItemSchema>
