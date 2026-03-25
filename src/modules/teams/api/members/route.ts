import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { TeamMember } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'teams:team_member'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('joined_at'),
    sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
    team_id: z.string().uuid().optional(),
    customer_user_id: z.string().uuid().optional(),
    competition_id: z.string().uuid().optional(),
    organizationId: z.string().uuid().optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

export const { metadata, GET, POST, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['teams.view'] },
    POST: { requireAuth: true, requireFeatures: ['teams.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['teams.manage'] },
  },
  orm: {
    entity: TeamMember,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: { module: 'teams', entity: 'member', persistent: true },
  indexer: { entityType: ENTITY_ID },
  list: {
    schema: querySchema,
    entityId: ENTITY_ID,
    fields: ['id', 'team_id', 'customer_user_id', 'competition_id', 'role', 'joined_at', 'left_at', 'tenant_id', 'organization_id'],
    sortFieldMap: { id: 'id', role: 'role', joined_at: 'joined_at' },
    buildFilters: async (q) => {
      const filters: Record<string, unknown> = {}
      if (q.id) filters.id = q.id
      if (q.team_id) filters.team_id = q.team_id
      if (q.customer_user_id) filters.customer_user_id = q.customer_user_id
      if (q.competition_id) filters.competition_id = q.competition_id
      if (q.organizationId) filters.organization_id = q.organizationId
      return filters
    },
    transformItem: (item) => ({
      id: String((item as Record<string, unknown>).id),
      team_id: String((item as Record<string, unknown>).team_id),
      customer_user_id: String((item as Record<string, unknown>).customer_user_id),
      competition_id: String((item as Record<string, unknown>).competition_id),
      role: String((item as Record<string, unknown>).role),
      joined_at: (item as Record<string, unknown>).joined_at,
      left_at: (item as Record<string, unknown>).left_at ?? null,
    }),
  },
  actions: {
    create: {
      commandId: 'teams.members.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    delete: {
      commandId: 'teams.members.delete',
      response: () => ({ ok: true }),
    },
  },
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Teams',
  summary: 'Team member management',
  methods: {
    GET: { summary: 'List team members' },
    POST: { summary: 'Add a team member' },
    DELETE: { summary: 'Remove a team member' },
  },
}
