import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { Team } from '../../data/entities'
import { teamListItemSchema as teamListItemDocSchema } from '../../data/validators'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import { teamCrudEvents, teamCrudIndexer } from '../../commands/teams'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  createTeamsCrudOpenApi,
  createTeamsPagedListResponseSchema,
  createdSchema,
  okSchema,
} from '../openapi'

// Query (list) schema
const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('name'),
    sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
    competitionId: z.string().uuid().optional(),
    trackId: z.string().uuid().optional(),
    status: z.enum(['ACTIVE', 'DISQUALIFIED', 'WITHDRAWN']).optional(),
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
const track_id = 'track_id'
const name = 'name'
const description = 'description'
const avatar_url = 'avatar_url'
const status = 'status'
const is_finalist = 'is_finalist'
const table_number = 'table_number'
const table_location = 'table_location'
const presentation_order = 'presentation_order'
const is_active = 'is_active'
const created_at = 'created_at'
const updated_at = 'updated_at'
const tenant_id = 'tenant_id'
const organization_id = 'organization_id'

const listFields = [
  id, competition_id, track_id, name, description, avatar_url,
  status, is_finalist, table_number, table_location, presentation_order,
  is_active, created_at, updated_at,
]

const sortFieldMap: Record<string, unknown> = {
  id,
  name,
  status,
  created_at,
  updated_at,
  tenant_id,
  organization_id,
}

type BaseFields = {
  id: string
  competition_id: string
  track_id: string | null
  name: string
  description: string | null
  avatar_url: string | null
  status: string
  is_finalist: boolean
  table_number: number | null
  table_location: string | null
  presentation_order: number | null
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: false },
    POST: { requireAuth: true, requireFeatures: ['teams.create'] },
    PUT: { requireAuth: true, requireFeatures: ['teams.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['teams.delete'] },
  },
  orm: {
    entity: Team,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
  },
  events: { module: 'teams', entity: 'team', persistent: true },
  indexer: { entityType: 'teams:team' },
  list: {
    entityId: E.teams.team,
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
      if (q.name) F.name = { $ilike: `%${q.name}%` }
      if (q.isActive !== undefined) F.is_active = q.isActive
      return filters
    },
    transformItem: (item: BaseFields) => ({
      id: String(item.id),
      competition_id: String(item.competition_id),
      track_id: item.track_id ? String(item.track_id) : null,
      name: String(item.name),
      description: item.description ? String(item.description) : null,
      avatar_url: item.avatar_url ? String(item.avatar_url) : null,
      status: String(item.status),
      is_finalist: item.is_finalist,
      table_number: item.table_number ?? null,
      table_location: item.table_location ? String(item.table_location) : null,
      presentation_order: item.presentation_order ?? null,
      is_active: item.is_active,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }),
  },
  actions: {
    create: {
      commandId: 'teams.team.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'teams.team.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'teams.team.delete',
      response: () => ({ ok: true }),
    },
  },
})

const teamDeleteSchema = z.object({
  id: z.string().uuid(),
})

export const openApi: OpenApiRouteDoc = createTeamsCrudOpenApi({
  resourceName: 'Team',
  pluralName: 'Teams',
  querySchema,
  listResponseSchema: createTeamsPagedListResponseSchema(teamListItemDocSchema),
  create: {
    schema: rawBodySchema,
    description: 'Creates a new team within a competition.',
    responseSchema: createdSchema,
  },
  update: {
    schema: rawBodySchema,
    description: 'Updates an existing team by id.',
    responseSchema: okSchema,
  },
  del: {
    schema: teamDeleteSchema,
    description: 'Deletes a team by id.',
    responseSchema: okSchema,
  },
})
