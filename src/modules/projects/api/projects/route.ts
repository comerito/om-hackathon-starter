import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { Project } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'projects:project'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('title'),
    sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
    competition_id: z.string().uuid().optional(),
    track_id: z.string().uuid().optional(),
    team_id: z.string().uuid().optional(),
    status: z.string().optional(),
    flagged_for_reuse: z.enum(['true', 'false']).optional(),
    title: z.string().optional(),
    organizationId: z.string().uuid().optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

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
  status: string
  flagged_for_reuse: boolean
  flagged_by: string | null
  flagged_at: Date | null
  flagged_reason: string | null
  submitted_at: Date | null
  final_score: number | null
  peer_vote_count: number | null
  rank: number | null
  manual_rank_override: number | null
  tenant_id: string
  organization_id: string
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
    softDeleteField: 'deletedAt',
  },
  events: { module: 'projects', entity: 'project', persistent: true },
  indexer: { entityType: ENTITY_ID },
  enrichers: { entityId: ENTITY_ID },
  list: {
    schema: querySchema,
    entityId: ENTITY_ID,
    fields: [
      'id', 'team_id', 'competition_id', 'track_id', 'title', 'tagline', 'description',
      'problem_statement', 'solution', 'tech_stack',
      'demo_url', 'repo_url', 'video_url', 'presentation_url',
      'screenshot_ids', 'attachment_ids',
      'uses_preexisting_code', 'preexisting_code_description', 'built_during_hackathon_description',
      'status', 'flagged_for_reuse', 'flagged_by', 'flagged_at', 'flagged_reason', 'submitted_at',
      'final_score', 'peer_vote_count', 'rank',
      'manual_rank_override', 'tenant_id', 'organization_id', 'is_active', 'created_at', 'updated_at',
    ],
    sortFieldMap: { id: 'id', title: 'title', status: 'status', created_at: 'created_at', submitted_at: 'submitted_at', final_score: 'final_score' },
    buildFilters: async (q: Query) => {
      const filters: Record<string, unknown> = {}
      if (q.id) filters.id = q.id
      if (q.competition_id) filters.competition_id = q.competition_id
      if (q.track_id) filters.track_id = q.track_id
      if (q.team_id) filters.team_id = q.team_id
      if (q.status) filters.status = q.status
      if (q.flagged_for_reuse === 'true') filters.flagged_for_reuse = true
      if (q.flagged_for_reuse === 'false') filters.flagged_for_reuse = false
      if (q.title) filters.title = { $ilike: `%${q.title}%` }
      if (q.organizationId) filters.organization_id = q.organizationId
      return filters
    },
    transformItem: (item: BaseFields) => ({
      id: String(item.id),
      team_id: String(item.team_id),
      competition_id: String(item.competition_id),
      track_id: String(item.track_id),
      title: String(item.title),
      tagline: item.tagline ?? null,
      description: item.description ?? null,
      problem_statement: item.problem_statement ?? null,
      solution: item.solution ?? null,
      tech_stack: item.tech_stack ?? [],
      demo_url: item.demo_url ?? null,
      repo_url: item.repo_url ?? null,
      video_url: item.video_url ?? null,
      presentation_url: item.presentation_url ?? null,
      screenshot_ids: item.screenshot_ids ?? [],
      attachment_ids: item.attachment_ids ?? [],
      uses_preexisting_code: Boolean(item.uses_preexisting_code),
      preexisting_code_description: item.preexisting_code_description ?? null,
      built_during_hackathon_description: item.built_during_hackathon_description ?? null,
      status: String(item.status),
      flagged_for_reuse: Boolean(item.flagged_for_reuse),
      flagged_by: item.flagged_by ?? null,
      flagged_at: item.flagged_at ?? null,
      flagged_reason: item.flagged_reason ?? null,
      submitted_at: item.submitted_at ?? null,
      final_score: item.final_score ?? null,
      peer_vote_count: item.peer_vote_count ?? null,
      rank: item.rank ?? null,
      manual_rank_override: item.manual_rank_override ?? null,
      tenant_id: item.tenant_id,
      organization_id: item.organization_id,
      is_active: Boolean(item.is_active),
      created_at: item.created_at,
      updated_at: item.updated_at,
    }),
  },
  actions: {
    create: {
      commandId: 'projects.projects.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'projects.projects.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'projects.projects.delete',
      response: () => ({ ok: true }),
    },
  },
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Projects',
  summary: 'Project management',
  methods: {
    GET: { summary: 'List projects' },
    POST: { summary: 'Create a project' },
    PUT: { summary: 'Update a project' },
    DELETE: { summary: 'Delete a project' },
  },
}
