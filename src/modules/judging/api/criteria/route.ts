import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { JudgingCriterion } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'judging:judging_criterion'
const querySchema = z.object({
  id: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  sortField: z.string().optional().default('order'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
  competition_id: z.string().uuid().optional(),
  track_id: z.string().uuid().optional(),
  round: z.string().optional(),
  organizationId: z.string().uuid().optional(),
}).passthrough()

const rawBodySchema = z.object({}).passthrough()
type Query = z.infer<typeof querySchema>

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['judging.view'] },
    POST: { requireAuth: true, requireFeatures: ['judging.criteria.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['judging.criteria.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['judging.criteria.manage'] },
  },
  orm: { entity: JudgingCriterion, idField: 'id', orgField: 'organizationId', tenantField: 'tenantId', softDeleteField: 'deletedAt' },
  events: { module: 'judging', entity: 'criterion', persistent: true },
  indexer: { entityType: ENTITY_ID },
  list: {
    schema: querySchema, entityId: ENTITY_ID,
    fields: ['id', 'competition_id', 'track_id', 'round', 'name', 'description', 'max_score', 'weight', 'order', 'tenant_id', 'organization_id', 'created_at'],
    sortFieldMap: { id: 'id', name: 'name', order: 'order', weight: 'weight', created_at: 'created_at' },
    buildFilters: async (q: Query) => {
      const f: Record<string, unknown> = {}
      if (q.id) f.id = q.id
      if (q.competition_id) f.competition_id = q.competition_id
      if (q.track_id) f.track_id = q.track_id
      if (q.round) f.round = q.round
      if (q.organizationId) f.organization_id = q.organizationId
      return f
    },
    transformItem: (item: Record<string, unknown>) => ({
      id: String(item.id), competition_id: String(item.competition_id),
      track_id: item.track_id ? String(item.track_id) : null,
      round: String(item.round), name: String(item.name),
      description: item.description ?? null,
      max_score: Number(item.max_score), weight: Number(item.weight), order: Number(item.order),
      tenant_id: item.tenant_id, organization_id: item.organization_id, created_at: item.created_at,
    }),
  },
  actions: {
    create: { commandId: 'judging.criteria.create', schema: rawBodySchema, mapInput: ({ parsed }) => parsed, response: ({ result }) => ({ id: String(result.id) }), status: 201 },
    update: { commandId: 'judging.criteria.update', schema: rawBodySchema, mapInput: ({ parsed }) => parsed, response: () => ({ ok: true }) },
    delete: { commandId: 'judging.criteria.delete', response: () => ({ ok: true }) },
  },
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Judging', summary: 'Judging criteria management',
  methods: { GET: { summary: 'List criteria' }, POST: { summary: 'Create criterion' }, PUT: { summary: 'Update criterion' }, DELETE: { summary: 'Delete criterion' } },
}
