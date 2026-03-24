import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { TeamResource } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'teams:resource'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('created_at'),
    sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
    team_id: z.string().uuid().optional(),
    organizationId: z.string().uuid().optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

type BaseFields = {
  id: string
  team_id: string
  name: string
  type: string
  url: string | null
  file_id: string | null
  metadata: Record<string, unknown>
  added_by: string
  tenant_id: string
  organization_id: string
  created_at: Date
  updated_at: Date
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['teams.view'] },
    POST: { requireAuth: true, requireFeatures: ['teams.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['teams.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['teams.manage'] },
  },
  orm: {
    entity: TeamResource,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
  },
  events: { module: 'teams', entity: 'resource', persistent: true },
  indexer: { entityType: ENTITY_ID },
  list: {
    schema: querySchema,
    entityId: ENTITY_ID,
    fields: ['id', 'team_id', 'name', 'type', 'url', 'file_id', 'metadata', 'added_by', 'tenant_id', 'organization_id', 'created_at', 'updated_at'],
    sortFieldMap: { id: 'id', name: 'name', type: 'type', created_at: 'created_at' },
    buildFilters: async (q: Query) => {
      const filters: Record<string, unknown> = {}
      if (q.id) filters.id = q.id
      if (q.team_id) filters.team_id = q.team_id
      if (q.organizationId) filters.organization_id = q.organizationId
      return filters
    },
    transformItem: (item: BaseFields) => ({
      id: String(item.id),
      team_id: String(item.team_id),
      name: String(item.name),
      type: String(item.type),
      url: item.url ?? null,
      file_id: item.file_id ?? null,
      metadata: item.metadata ?? {},
      added_by: String(item.added_by),
      tenant_id: item.tenant_id,
      organization_id: item.organization_id,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }),
  },
  actions: {
    create: {
      commandId: 'teams.resources.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'teams.resources.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'teams.resources.delete',
      response: () => ({ ok: true }),
    },
  },
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Teams',
  summary: 'Team resource management',
  methods: {
    GET: { summary: 'List team resources' },
    POST: { summary: 'Create a team resource' },
    PUT: { summary: 'Update a team resource' },
    DELETE: { summary: 'Delete a team resource' },
  },
}
