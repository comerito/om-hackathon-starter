import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { Team } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'teams:team'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('name'),
    sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
    competition_id: z.string().uuid().optional(),
    track_id: z.string().uuid().optional(),
    status: z.string().optional(),
    name: z.string().optional(),
    organizationId: z.string().uuid().optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

type BaseFields = {
  id: string
  competition_id: string
  track_id: string | null
  name: string
  description: string | null
  status: string
  is_finalist: boolean
  table_number: number | null
  table_location: string | null
  tenant_id: string
  organization_id: string
  is_active: boolean
  created_at: Date
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['teams.view'] },
    POST: { requireAuth: true, requireFeatures: ['teams.create'] },
    PUT: { requireAuth: true, requireFeatures: ['teams.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['teams.delete'] },
  },
  orm: {
    entity: Team,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: { module: 'teams', entity: 'team', persistent: true },
  indexer: { entityType: ENTITY_ID },
  list: {
    schema: querySchema,
    entityId: ENTITY_ID,
    fields: ['id', 'competition_id', 'track_id', 'name', 'description', 'status', 'is_finalist', 'table_number', 'table_location', 'tenant_id', 'organization_id', 'is_active', 'created_at'],
    sortFieldMap: { id: 'id', name: 'name', status: 'status', created_at: 'created_at' },
    buildFilters: async (q: Query) => {
      const filters: Record<string, unknown> = {}
      if (q.id) filters.id = q.id
      if (q.competition_id) filters.competition_id = q.competition_id
      if (q.track_id) filters.track_id = q.track_id
      if (q.status) filters.status = q.status
      if (q.name) filters.name = { $ilike: `%${q.name}%` }
      if (q.organizationId) filters.organization_id = q.organizationId
      return filters
    },
    transformItem: (item: BaseFields) => ({
      id: String(item.id),
      competition_id: String(item.competition_id),
      track_id: item.track_id ? String(item.track_id) : null,
      name: String(item.name),
      description: item.description ?? null,
      status: String(item.status),
      is_finalist: Boolean(item.is_finalist),
      table_number: item.table_number ?? null,
      table_location: item.table_location ?? null,
      tenant_id: item.tenant_id,
      organization_id: item.organization_id,
      is_active: Boolean(item.is_active),
      created_at: item.created_at,
    }),
  },
  actions: {
    create: {
      commandId: 'teams.teams.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'teams.teams.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'teams.teams.delete',
      response: () => ({ ok: true }),
    },
  },
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Teams',
  summary: 'Team management',
  methods: {
    GET: { summary: 'List teams' },
    POST: { summary: 'Create a team' },
    PUT: { summary: 'Update a team' },
    DELETE: { summary: 'Delete a team' },
  },
}
