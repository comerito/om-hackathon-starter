import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { Track } from '../../data/entities'
import { trackListItemSchema as trackListItemDocSchema } from '../../data/validators'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import { trackCrudEvents, trackCrudIndexer } from '../../commands/tracks'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  createTracksCrudOpenApi,
  createTracksPagedListResponseSchema,
  createdSchema,
  okSchema,
} from '../openapi'

// Query (list) schema
const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('order'),
    sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
    competitionId: z.string().uuid().optional(),
    name: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
    format: z.enum(['json', 'csv']).optional(),
  })
  .passthrough()

// Create/Update schemas — passthrough so the command layer does full validation
const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

// Column references
const id = 'id'
const competition_id = 'competition_id'
const name = 'name'
const description = 'description'
const color = 'color'
const icon_url = 'icon_url'
const max_teams = 'max_teams'
const order = 'order'
const mentor_ids = 'mentor_ids'
const is_active = 'is_active'
const created_at = 'created_at'
const tenant_id = 'tenant_id'
const organization_id = 'organization_id'

const listFields = [id, competition_id, name, description, color, icon_url, max_teams, order, mentor_ids, is_active, created_at]

const sortFieldMap: Record<string, unknown> = {
  id,
  name,
  order,
  max_teams,
  created_at,
  tenant_id,
  organization_id,
}

type BaseFields = {
  id: string
  competition_id: string
  name: string
  description: string | null
  color: string
  icon_url: string | null
  max_teams: number | null
  order: number
  mentor_ids: string[]
  is_active: boolean
  created_at: Date
}

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
  },
  events: { module: 'tracks', entity: 'track', persistent: true },
  indexer: { entityType: 'tracks:track' },
  list: {
    entityId: E.tracks.track,
    schema: querySchema,
    fields: listFields,
    sortFieldMap,
    buildFilters: async (q: Query): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>
      if (q.id) F.id = q.id
      if (q.competitionId) F.competition_id = q.competitionId
      if (q.name) F.name = { $ilike: `%${q.name}%` }
      if (q.isActive !== undefined) F.is_active = q.isActive
      return filters
    },
    transformItem: (item: BaseFields) => ({
      id: String(item.id),
      competition_id: String(item.competition_id),
      name: String(item.name),
      description: item.description ? String(item.description) : null,
      color: String(item.color),
      icon_url: item.icon_url ? String(item.icon_url) : null,
      max_teams: item.max_teams ?? null,
      order: item.order,
      mentor_ids: Array.isArray(item.mentor_ids) ? item.mentor_ids : [],
      is_active: item.is_active,
      created_at: item.created_at,
    }),
  },
  actions: {
    create: {
      commandId: 'tracks.track.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'tracks.track.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'tracks.track.delete',
      response: () => ({ ok: true }),
    },
  },
})

const trackDeleteSchema = z.object({
  id: z.string().uuid(),
})

export const openApi: OpenApiRouteDoc = createTracksCrudOpenApi({
  resourceName: 'Track',
  pluralName: 'Tracks',
  querySchema,
  listResponseSchema: createTracksPagedListResponseSchema(trackListItemDocSchema),
  create: {
    schema: rawBodySchema,
    description: 'Creates a new track within a competition.',
    responseSchema: createdSchema,
  },
  update: {
    schema: rawBodySchema,
    description: 'Updates an existing track by id.',
    responseSchema: okSchema,
  },
  del: {
    schema: trackDeleteSchema,
    description: 'Deletes a track by id.',
    responseSchema: okSchema,
  },
})
