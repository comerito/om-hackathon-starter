import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { JudgingCriterion } from '../../data/entities'
import { listCriterionSchema, criterionListItemSchema } from '../../data/validators'
import { criterionCrudEvents } from '../../commands/judging'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { createJudgingCrudOpenApi, createJudgingPagedListResponseSchema, createdSchema, okSchema } from '../openapi'

// ---------------------------------------------------------------------------
// Query (list) schema
// ---------------------------------------------------------------------------

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('order'),
    sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
    competitionId: z.string().uuid().optional(),
    trackId: z.string().uuid().optional(),
    round: z.enum(['PRELIMINARY', 'FINAL', 'BOTH']).optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

const id = 'id'
const competition_id = 'competition_id'
const track_id = 'track_id'
const round = 'round'
const name = 'name'
const description = 'description'
const max_score = 'max_score'
const weight = 'weight'
const order = 'order'
const tenant_id = 'tenant_id'
const organization_id = 'organization_id'
const created_at = 'created_at'
const deleted_at = 'deleted_at'

const listFields = [
  id, competition_id, track_id, round, name, description,
  max_score, weight, order, created_at, deleted_at,
]

const sortFieldMap: Record<string, unknown> = { id, name, order, weight, created_at }

type BaseFields = {
  id: string
  competition_id: string
  track_id: string | null
  round: string
  name: string
  description: string | null
  max_score: number
  weight: number
  order: number
  created_at: Date
  deleted_at: Date | null
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['judging.view'] },
    POST: { requireAuth: true, requireFeatures: ['judging.criteria.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['judging.criteria.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['judging.criteria.manage'] },
  },
  orm: {
    entity: JudgingCriterion,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
  },
  events: { module: 'judging', entity: 'criterion', persistent: true },
  list: {
    schema: querySchema,
    fields: listFields,
    sortFieldMap,
    buildFilters: async (q: Query): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>
      if (q.id) F.id = q.id
      if (q.competitionId) F.competition_id = q.competitionId
      if (q.trackId) F.track_id = q.trackId
      if (q.round) F.round = q.round
      F.deleted_at = null
      return filters
    },
    transformItem: (item: BaseFields) => ({
      id: String(item.id),
      competition_id: String(item.competition_id),
      track_id: item.track_id ? String(item.track_id) : null,
      round: String(item.round),
      name: String(item.name),
      description: item.description ? String(item.description) : null,
      max_score: Number(item.max_score),
      weight: Number(item.weight),
      order: Number(item.order),
      created_at: item.created_at,
    }),
  },
  actions: {
    create: {
      commandId: 'judging.criterion.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'judging.criterion.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'judging.criterion.delete',
      response: () => ({ ok: true }),
    },
  },
})

export const openApi: OpenApiRouteDoc = createJudgingCrudOpenApi({
  resourceName: 'JudgingCriterion',
  pluralName: 'Judging Criteria',
  querySchema,
  listResponseSchema: createJudgingPagedListResponseSchema(criterionListItemSchema),
  create: {
    schema: rawBodySchema,
    description: 'Creates a new judging criterion. Weight validation: weights for a scope (track or global) should sum to at most 1.0.',
    responseSchema: createdSchema,
  },
  update: {
    schema: rawBodySchema,
    description: 'Updates an existing judging criterion by id.',
    responseSchema: okSchema,
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    description: 'Soft-deletes a judging criterion by id.',
    responseSchema: okSchema,
  },
})
