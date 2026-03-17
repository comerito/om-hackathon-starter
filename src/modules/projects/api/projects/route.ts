import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { Project } from '../../data/entities'
import { projectListItemSchema as projectListItemDocSchema } from '../../data/validators'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import { projectCrudEvents, projectCrudIndexer } from '../../commands/projects'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  createProjectsCrudOpenApi,
  createProjectsPagedListResponseSchema,
  createdSchema,
  okSchema,
} from '../openapi'

// Query (list) schema
const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('title'),
    sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
    competitionId: z.string().uuid().optional(),
    trackId: z.string().uuid().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'UNDER_REVIEW', 'SCORED']).optional(),
    teamId: z.string().uuid().optional(),
    flaggedForReuse: z.coerce.boolean().optional(),
    isActive: z.coerce.boolean().optional(),
    format: z.enum(['json', 'csv']).optional(),
  })
  .passthrough()

// Create/Update schemas — passthrough so the command layer does full validation
const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

// Column references
const id = 'id'
const team_id = 'team_id'
const competition_id = 'competition_id'
const track_id = 'track_id'
const title = 'title'
const tagline = 'tagline'
const description = 'description'
const problem_statement = 'problem_statement'
const solution = 'solution'
const tech_stack = 'tech_stack'
const demo_url = 'demo_url'
const repo_url = 'repo_url'
const video_url = 'video_url'
const presentation_url = 'presentation_url'
const screenshot_ids = 'screenshot_ids'
const attachment_ids = 'attachment_ids'
const uses_preexisting_code = 'uses_preexisting_code'
const preexisting_code_description = 'preexisting_code_description'
const built_during_hackathon_description = 'built_during_hackathon_description'
const flagged_for_reuse = 'flagged_for_reuse'
const flagged_by = 'flagged_by'
const flagged_at = 'flagged_at'
const flagged_reason = 'flagged_reason'
const status = 'status'
const submitted_at = 'submitted_at'
const final_score = 'final_score'
const peer_vote_count = 'peer_vote_count'
const rank = 'rank'
const manual_rank_override = 'manual_rank_override'
const is_active = 'is_active'
const created_at = 'created_at'
const updated_at = 'updated_at'
const tenant_id = 'tenant_id'
const organization_id = 'organization_id'

const listFields = [
  id, team_id, competition_id, track_id, title, tagline, description,
  problem_statement, solution, tech_stack,
  demo_url, repo_url, video_url, presentation_url,
  screenshot_ids, attachment_ids,
  uses_preexisting_code, preexisting_code_description, built_during_hackathon_description,
  flagged_for_reuse, flagged_by, flagged_at, flagged_reason,
  status, submitted_at,
  final_score, peer_vote_count, rank, manual_rank_override,
  is_active, created_at, updated_at,
]

const sortFieldMap: Record<string, unknown> = {
  id,
  title,
  status,
  submitted_at,
  final_score,
  rank,
  created_at,
  updated_at,
  tenant_id,
  organization_id,
}

type BaseFields = {
  id: string
  team_id: string
  competition_id: string
  track_id: string
  title: string
  tagline: string | null
  description: string | null
  problem_statement: string | null
  solution: string | null
  tech_stack: string[]
  demo_url: string | null
  repo_url: string | null
  video_url: string | null
  presentation_url: string | null
  screenshot_ids: string[]
  attachment_ids: string[]
  uses_preexisting_code: boolean
  preexisting_code_description: string | null
  built_during_hackathon_description: string | null
  flagged_for_reuse: boolean
  flagged_by: string | null
  flagged_at: Date | null
  flagged_reason: string | null
  status: string
  submitted_at: Date | null
  final_score: number | null
  peer_vote_count: number | null
  rank: number | null
  manual_rank_override: number | null
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['projects.view'] },
    POST: { requireAuth: true, requireFeatures: ['projects.create'] },
    PUT: { requireAuth: true, requireFeatures: ['projects.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['projects.delete'] },
  },
  orm: {
    entity: Project,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
  },
  events: { module: 'projects', entity: 'project', persistent: true },
  indexer: { entityType: 'projects:project' },
  list: {
    schema: querySchema,
    fields: listFields,
    sortFieldMap,
    buildFilters: async (q: Query): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>
      if (q.id) F.id = q.id
      if (q.competitionId) F.competition_id = q.competitionId
      if (q.trackId) F.track_id = q.trackId
      if (q.status) F.status = q.status
      if (q.teamId) F.team_id = q.teamId
      if (q.flaggedForReuse !== undefined) F.flagged_for_reuse = q.flaggedForReuse
      if (q.isActive !== undefined) F.is_active = q.isActive
      return filters
    },
    transformItem: (item: BaseFields) => ({
      id: String(item.id),
      team_id: String(item.team_id),
      competition_id: String(item.competition_id),
      track_id: String(item.track_id),
      title: String(item.title),
      tagline: item.tagline ? String(item.tagline) : null,
      description: item.description ? String(item.description) : null,
      problem_statement: item.problem_statement ? String(item.problem_statement) : null,
      solution: item.solution ? String(item.solution) : null,
      tech_stack: Array.isArray(item.tech_stack) ? item.tech_stack : [],
      demo_url: item.demo_url ? String(item.demo_url) : null,
      repo_url: item.repo_url ? String(item.repo_url) : null,
      video_url: item.video_url ? String(item.video_url) : null,
      presentation_url: item.presentation_url ? String(item.presentation_url) : null,
      screenshot_ids: Array.isArray(item.screenshot_ids) ? item.screenshot_ids : [],
      attachment_ids: Array.isArray(item.attachment_ids) ? item.attachment_ids : [],
      uses_preexisting_code: item.uses_preexisting_code,
      preexisting_code_description: item.preexisting_code_description ? String(item.preexisting_code_description) : null,
      built_during_hackathon_description: item.built_during_hackathon_description ? String(item.built_during_hackathon_description) : null,
      flagged_for_reuse: item.flagged_for_reuse,
      flagged_by: item.flagged_by ? String(item.flagged_by) : null,
      flagged_at: item.flagged_at,
      flagged_reason: item.flagged_reason ? String(item.flagged_reason) : null,
      status: String(item.status),
      submitted_at: item.submitted_at,
      final_score: item.final_score,
      peer_vote_count: item.peer_vote_count,
      rank: item.rank,
      manual_rank_override: item.manual_rank_override,
      is_active: item.is_active,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }),
  },
  actions: {
    create: {
      commandId: 'projects.project.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'projects.project.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'projects.project.delete',
      response: () => ({ ok: true }),
    },
  },
})

const projectDeleteSchema = z.object({
  id: z.string().uuid(),
})

export const openApi: OpenApiRouteDoc = createProjectsCrudOpenApi({
  resourceName: 'Project',
  pluralName: 'Projects',
  querySchema,
  listResponseSchema: createProjectsPagedListResponseSchema(projectListItemDocSchema),
  create: {
    schema: rawBodySchema,
    description: 'Creates a new project submission.',
    responseSchema: createdSchema,
  },
  update: {
    schema: rawBodySchema,
    description: 'Updates an existing project by id.',
    responseSchema: okSchema,
  },
  del: {
    schema: projectDeleteSchema,
    description: 'Deletes a project by id.',
    responseSchema: okSchema,
  },
})
