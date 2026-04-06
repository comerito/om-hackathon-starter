import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { BountyPullRequest } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'bounties:bounty_pull_request'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('created_at'),
    sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
    competition_id: z.string().uuid().optional(),
    status: z.string().optional(),
    github_author: z.string().optional(),
    is_duplicate: z.enum(['true', 'false']).optional(),
    organizationId: z.string().uuid().optional(),
  })
  .passthrough()

type Query = z.infer<typeof querySchema>

type BaseFields = {
  id: string
  competition_id: string
  github_pr_id: number
  github_pr_number: number
  github_pr_url: string
  title: string
  description: string | null
  github_author: string
  participant_id: string | null
  team_id: string | null
  status: string
  classifications: unknown
  classification_confidence: number | null
  classification_summary: string | null
  total_points: number
  points_override: unknown
  is_duplicate: boolean
  duplicate_of_id: string | null
  duplicate_marked_by: string | null
  duplicate_similarity: number | null
  github_created_at: Date
  tenant_id: string
  organization_id: string
  created_at: Date
  updated_at: Date
}

export const { metadata, GET } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['bounties.view'] },
  },
  orm: {
    entity: BountyPullRequest,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  enrichers: { entityId: ENTITY_ID },
  list: {
    schema: querySchema,
    entityId: ENTITY_ID,
    fields: [
      'id', 'competition_id', 'github_pr_id', 'github_pr_number', 'github_pr_url',
      'title', 'description', 'github_author', 'participant_id', 'team_id',
      'status', 'classifications', 'classification_confidence', 'classification_summary',
      'total_points', 'points_override', 'is_duplicate', 'duplicate_of_id',
      'duplicate_marked_by', 'duplicate_similarity', 'github_created_at',
      'tenant_id', 'organization_id', 'created_at', 'updated_at',
    ],
    sortFieldMap: {
      id: 'id',
      title: 'title',
      status: 'status',
      total_points: 'total_points',
      created_at: 'created_at',
      github_created_at: 'github_created_at',
    },
    buildFilters: async (q: Query) => {
      const filters: Record<string, unknown> = {}
      if (q.id) filters.id = q.id
      if (q.competition_id) filters.competition_id = q.competition_id
      if (q.status) filters.status = q.status
      if (q.github_author) filters.github_author = { $ilike: `%${q.github_author}%` }
      if (q.is_duplicate === 'true') filters.is_duplicate = true
      if (q.is_duplicate === 'false') filters.is_duplicate = false
      if (q.organizationId) filters.organization_id = q.organizationId
      return filters
    },
    transformItem: (item: BaseFields) => ({
      id: item.id,
      competition_id: item.competition_id,
      github_pr_id: item.github_pr_id,
      github_pr_number: item.github_pr_number,
      github_pr_url: item.github_pr_url,
      title: item.title,
      description: item.description,
      github_author: item.github_author,
      participant_id: item.participant_id,
      team_id: item.team_id,
      status: item.status,
      classifications: item.classifications,
      classification_confidence: item.classification_confidence,
      classification_summary: item.classification_summary,
      total_points: item.total_points,
      points_override: item.points_override,
      is_duplicate: item.is_duplicate,
      duplicate_of_id: item.duplicate_of_id,
      duplicate_marked_by: item.duplicate_marked_by,
      duplicate_similarity: item.duplicate_similarity,
      github_created_at: item.github_created_at,
      tenant_id: item.tenant_id,
      organization_id: item.organization_id,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }),
  },
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties',
  summary: 'Bounty pull request management',
  methods: {
    GET: { summary: 'List bounty PRs' },
  },
}
