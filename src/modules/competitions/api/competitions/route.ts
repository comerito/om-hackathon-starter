import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { Competition } from '../../data/entities'
import { competitionCrudEvents, competitionCrudIndexer } from '../../commands/competitions'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'competitions:competition'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('name'),
    sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
    name: z.string().optional(),
    stage: z.string().optional(),
    organizationId: z.string().uuid().optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

type BaseFields = {
  id: string
  name: string
  slug: string
  stage: string
  starts_at: Date
  ends_at: Date
  tenant_id: string
  organization_id: string
  is_active: boolean
  created_at: Date
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['competitions.view'] },
    POST: { requireAuth: true, requireFeatures: ['competitions.create'] },
    PUT: { requireAuth: true, requireFeatures: ['competitions.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['competitions.delete'] },
  },
  orm: {
    entity: Competition,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: { module: 'competitions', entity: 'competition', persistent: true },
  indexer: { entityType: ENTITY_ID },
  list: {
    schema: querySchema,
    entityId: ENTITY_ID,
    fields: ['id', 'name', 'slug', 'stage', 'starts_at', 'ends_at', 'location', 'timezone', 'min_team_size', 'max_team_size', 'tenant_id', 'organization_id', 'is_active', 'created_at'],
    sortFieldMap: { id: 'id', name: 'name', slug: 'slug', stage: 'stage', starts_at: 'starts_at', ends_at: 'ends_at', created_at: 'created_at' },
    buildFilters: async (q: Query) => {
      const filters: Record<string, unknown> = {}
      if (q.id) filters.id = q.id
      if (q.name) filters.name = { $ilike: `%${q.name}%` }
      if (q.stage) filters.stage = q.stage
      if (q.organizationId) filters.organization_id = q.organizationId
      return filters
    },
    transformItem: (item: BaseFields) => ({
      id: String(item.id),
      name: String(item.name),
      slug: String(item.slug),
      stage: String(item.stage),
      starts_at: item.starts_at,
      ends_at: item.ends_at,
      tenant_id: item.tenant_id,
      organization_id: item.organization_id,
      is_active: Boolean(item.is_active),
      created_at: item.created_at,
    }),
  },
  actions: {
    create: {
      commandId: 'competitions.competitions.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'competitions.competitions.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'competitions.competitions.delete',
      response: () => ({ ok: true }),
    },
  },
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Competition management',
  methods: {
    GET: { summary: 'List competitions' },
    POST: { summary: 'Create a competition' },
    PUT: { summary: 'Update a competition' },
    DELETE: { summary: 'Delete a competition' },
  },
}
