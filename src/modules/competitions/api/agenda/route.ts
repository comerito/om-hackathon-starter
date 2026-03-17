import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { AgendaItem } from '../../data/entities'
import { agendaItemListItemSchema, agendaItemTypeSchema } from '../../data/validators'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import { agendaItemCrudEvents, agendaItemCrudIndexer } from '../../commands/agenda'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  createCompetitionsCrudOpenApi,
  createCompetitionsPagedListResponseSchema,
  createdSchema,
  okSchema,
} from '../openapi'

// Query (list) schema
const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('starts_at'),
    sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
    competitionId: z.string().uuid().optional(),
    type: agendaItemTypeSchema.optional(),
    trackId: z.string().uuid().optional(),
    isMandatory: z.coerce.boolean().optional(),
    organizationId: z.string().uuid().optional(),
    format: z.enum(['json', 'csv']).optional(),
  })
  .passthrough()

// Create/Update schemas — passthrough so the command layer does full validation
const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

// Column references
const id = 'id'
const competition_id = 'competition_id'
const title = 'title'
const description = 'description'
const type = 'type'
const starts_at = 'starts_at'
const ends_at = 'ends_at'
const location = 'location'
const speaker_name = 'speaker_name'
const speaker_bio = 'speaker_bio'
const track_id = 'track_id'
const is_mandatory = 'is_mandatory'
const order = 'order'
const created_at = 'created_at'
const updated_at = 'updated_at'
const tenant_id = 'tenant_id'
const organization_id = 'organization_id'

const listFields = [
  id, competition_id, title, description, type, starts_at, ends_at,
  location, speaker_name, speaker_bio, track_id, is_mandatory, order,
  created_at, updated_at,
]

const sortFieldMap: Record<string, unknown> = {
  id,
  title,
  type,
  starts_at,
  ends_at,
  order,
  created_at,
  tenant_id,
  organization_id,
}

type BaseFields = {
  id: string
  competition_id: string
  title: string
  description: string | null
  type: string
  starts_at: Date
  ends_at: Date
  location: string | null
  speaker_name: string | null
  speaker_bio: string | null
  track_id: string | null
  is_mandatory: boolean
  order: number
  created_at: Date
  updated_at: Date
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['competitions.view'] },
    POST: { requireAuth: true, requireFeatures: ['competitions.agenda.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['competitions.agenda.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['competitions.agenda.manage'] },
  },
  orm: {
    entity: AgendaItem,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
  },
  events: { module: 'competitions', entity: 'agenda_item', persistent: true },
  indexer: { entityType: 'competitions:agenda_item' },
  list: {
    schema: querySchema,
    fields: listFields,
    sortFieldMap,
    buildFilters: async (q: Query): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>
      if (q.id) F.id = q.id
      if (q.competitionId) F.competition_id = q.competitionId
      if (q.type) F.type = q.type
      if (q.trackId) F.track_id = q.trackId
      if (q.isMandatory !== undefined) F.is_mandatory = q.isMandatory
      if (q.organizationId) F.organization_id = q.organizationId
      return filters
    },
    transformItem: (item: BaseFields) => ({
      id: String(item.id),
      competition_id: String(item.competition_id),
      title: String(item.title),
      description: item.description,
      type: String(item.type),
      starts_at: item.starts_at,
      ends_at: item.ends_at,
      location: item.location,
      speaker_name: item.speaker_name,
      speaker_bio: item.speaker_bio,
      track_id: item.track_id,
      is_mandatory: item.is_mandatory,
      order: item.order,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }),
  },
  actions: {
    create: {
      commandId: 'competitions.agenda_item.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'competitions.agenda_item.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'competitions.agenda_item.delete',
      response: () => ({ ok: true }),
    },
  },
})

const agendaItemDeleteSchema = z.object({
  id: z.string().uuid(),
})

export const openApi: OpenApiRouteDoc = createCompetitionsCrudOpenApi({
  resourceName: 'AgendaItem',
  pluralName: 'AgendaItems',
  querySchema,
  listResponseSchema: createCompetitionsPagedListResponseSchema(agendaItemListItemSchema),
  create: {
    schema: rawBodySchema,
    description: 'Creates a new agenda item for a competition.',
    responseSchema: createdSchema,
  },
  update: {
    schema: rawBodySchema,
    description: 'Updates an existing agenda item by id.',
    responseSchema: okSchema,
  },
  del: {
    schema: agendaItemDeleteSchema,
    description: 'Deletes an agenda item by id.',
    responseSchema: okSchema,
  },
})
