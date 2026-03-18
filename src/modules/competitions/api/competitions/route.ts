import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { Competition } from '../../data/entities'
import { competitionListItemSchema as competitionListItemDocSchema } from '../../data/validators'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import { competitionCrudEvents, competitionCrudIndexer } from '../../commands/competitions'
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
    sortField: z.string().optional().default('created_at'),
    sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
    name: z.string().optional(),
    slug: z.string().optional(),
    stage: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
    withDeleted: z.coerce.boolean().optional().default(false),
    organizationId: z.string().uuid().optional(),
    createdFrom: z.string().optional(),
    createdTo: z.string().optional(),
    format: z.enum(['json', 'csv']).optional(),
  })
  .passthrough()

// Create/Update schemas — passthrough so the command layer does full validation
const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

// Column references (no generated column module yet, use string literals)
const id = 'id'
const name = 'name'
const slug = 'slug'
const stage = 'stage'
const location = 'location'
const starts_at = 'starts_at'
const ends_at = 'ends_at'
const created_at = 'created_at'
const tenant_id = 'tenant_id'
const organization_id = 'organization_id'

const listFields = [id, name, slug, stage, location, starts_at, ends_at, created_at]

const sortFieldMap: Record<string, unknown> = {
  id,
  name,
  slug,
  stage,
  location,
  starts_at,
  ends_at,
  created_at,
  tenant_id,
  organization_id,
}

type BaseFields = {
  id: string
  name: string
  slug: string
  stage: string
  location: string | null
  starts_at: Date | null
  ends_at: Date | null
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
  indexer: { entityType: 'competitions:competition' },
  list: {
    schema: querySchema,
    fields: listFields,
    sortFieldMap,
    buildFilters: async (q: Query): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>
      if (q.id) F.id = q.id
      if (q.name) F.name = { $ilike: `%${q.name}%` }
      if (q.slug) F.slug = { $ilike: `%${q.slug}%` }
      if (q.stage) F.stage = q.stage
      if (q.organizationId) F.organization_id = q.organizationId
      if (q.createdFrom || q.createdTo) {
        const range: { $gte?: Date; $lte?: Date } = {}
        if (q.createdFrom) range.$gte = new Date(q.createdFrom)
        if (q.createdTo) range.$lte = new Date(q.createdTo)
        F.created_at = range
      }
      return filters
    },
    transformItem: (item: BaseFields) => ({
      id: String(item.id),
      name: String(item.name),
      slug: String(item.slug),
      stage: String(item.stage),
      location: item.location ? String(item.location) : null,
      starts_at: item.starts_at,
      startsAt: item.starts_at,
      ends_at: item.ends_at,
      endsAt: item.ends_at,
      created_at: item.created_at,
    }),
    allowCsv: true,
    csv: {
      headers: ['id', 'name', 'slug', 'stage', 'location', 'starts_at', 'ends_at', 'created_at'],
      row: (item: Record<string, unknown>) => [
        item.id ?? '',
        item.name ?? '',
        item.slug ?? '',
        item.stage ?? '',
        item.location ?? '',
        item.starts_at ? String(item.starts_at) : '',
        item.ends_at ? String(item.ends_at) : '',
        item.created_at ? String(item.created_at) : '',
      ],
      filename: 'competitions.csv',
    },
  },
  actions: {
    create: {
      commandId: 'competitions.competition.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'competitions.competition.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'competitions.competition.delete',
      response: () => ({ ok: true }),
    },
  },
})

const competitionDeleteSchema = z.object({
  id: z.string().uuid(),
})

export const openApi: OpenApiRouteDoc = createCompetitionsCrudOpenApi({
  resourceName: 'Competition',
  pluralName: 'Competitions',
  querySchema,
  listResponseSchema: createCompetitionsPagedListResponseSchema(competitionListItemDocSchema),
  create: {
    schema: rawBodySchema,
    description: 'Creates a new competition (hackathon event).',
    responseSchema: createdSchema,
  },
  update: {
    schema: rawBodySchema,
    description: 'Updates an existing competition by id.',
    responseSchema: okSchema,
  },
  del: {
    schema: competitionDeleteSchema,
    description: 'Soft-deletes a competition by id.',
    responseSchema: okSchema,
  },
})
