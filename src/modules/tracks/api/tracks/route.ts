import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { Track } from '../../data/entities'
import { trackCrudEvents, trackCrudIndexer } from '../../commands/tracks'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'tracks:track'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('sort_order'),
    sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
    competition_id: z.string().uuid().optional(),
    name: z.string().optional(),
    organizationId: z.string().uuid().optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['tracks.view'] },
    POST: { requireAuth: true, requireFeatures: ['tracks.create'] },
    PUT: { requireAuth: true, requireFeatures: ['tracks.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['tracks.delete'] },
  },
  orm: {
    entity: Track,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: { module: 'tracks', entity: 'track', persistent: true },
  indexer: { entityType: ENTITY_ID },
  enrichers: { entityId: ENTITY_ID },
  list: {
    schema: querySchema,
    entityId: ENTITY_ID,
    fields: ['id', 'competition_id', 'name', 'description', 'color', 'icon_url', 'max_teams', 'sort_order', 'mentor_ids', 'is_active', 'tenant_id', 'organization_id', 'created_at'],
    sortFieldMap: { id: 'id', name: 'name', sort_order: 'sort_order', created_at: 'created_at' },
    buildFilters: async (q: Query) => {
      const filters: Record<string, unknown> = {}
      if (q.id) filters.id = q.id
      if (q.competition_id) filters.competition_id = q.competition_id
      if (q.name) filters.name = { $ilike: `%${q.name}%` }
      if (q.organizationId) filters.organization_id = q.organizationId
      return filters
    },
    transformItem: (item) => {
      const r = item as Record<string, unknown>
      return {
        id: String(r.id),
        competition_id: String(r.competition_id),
        name: String(r.name),
        description: r.description ?? null,
        color: String(r.color ?? '#6366f1'),
        icon_url: r.icon_url ?? null,
        max_teams: r.max_teams ?? null,
        order: Number(r.sort_order ?? 0),
        mentor_ids: r.mentor_ids ?? [],
        is_active: Boolean(r.is_active),
        created_at: r.created_at,
      }
    },
  },
  actions: {
    create: {
      commandId: 'tracks.tracks.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'tracks.tracks.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'tracks.tracks.delete',
      response: () => ({ ok: true }),
    },
  },
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Tracks',
  summary: 'Track management',
  methods: {
    GET: { summary: 'List tracks' },
    POST: { summary: 'Create a track' },
    PUT: { summary: 'Update a track' },
    DELETE: { summary: 'Delete a track' },
  },
}
