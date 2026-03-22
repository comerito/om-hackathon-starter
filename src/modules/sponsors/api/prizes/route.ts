import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { Prize } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'sponsors:prize'
const querySchema = z.object({
  id: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  sortField: z.string().optional().default('order'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
  competition_id: z.string().uuid().optional(),
  category: z.string().optional(),
  track_id: z.string().uuid().optional(),
  sponsor_id: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
}).passthrough()

const rawBodySchema = z.object({}).passthrough()
type Query = z.infer<typeof querySchema>

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['sponsors.view'] },
    POST: { requireAuth: true, requireFeatures: ['sponsors.prizes.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['sponsors.prizes.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['sponsors.prizes.manage'] },
  },
  orm: { entity: Prize, idField: 'id', orgField: 'organizationId', tenantField: 'tenantId', softDeleteField: 'deletedAt' },
  events: { module: 'sponsors', entity: 'prize', persistent: true },
  indexer: { entityType: ENTITY_ID },
  list: {
    schema: querySchema, entityId: ENTITY_ID,
    fields: ['id', 'competition_id', 'name', 'description', 'category', 'track_id', 'sponsor_id',
      'value', 'rank', 'winning_project_id', 'winning_team_id', 'awarded_at',
      'order', 'tenant_id', 'organization_id', 'created_at'],
    sortFieldMap: { id: 'id', name: 'name', category: 'category', order: 'order', rank: 'rank', created_at: 'created_at' },
    buildFilters: async (q: Query) => {
      const f: Record<string, unknown> = {}
      if (q.id) f.id = q.id
      if (q.competition_id) f.competition_id = q.competition_id
      if (q.category) f.category = q.category
      if (q.track_id) f.track_id = q.track_id
      if (q.sponsor_id) f.sponsor_id = q.sponsor_id
      if (q.organizationId) f.organization_id = q.organizationId
      return f
    },
    transformItem: (item: Record<string, unknown>) => ({
      id: String(item.id), competition_id: String(item.competition_id),
      name: String(item.name), description: item.description ?? null,
      category: String(item.category), track_id: item.track_id ? String(item.track_id) : null,
      sponsor_id: item.sponsor_id ? String(item.sponsor_id) : null,
      value: item.value ?? null, rank: item.rank ?? null,
      winning_project_id: item.winning_project_id ? String(item.winning_project_id) : null,
      winning_team_id: item.winning_team_id ? String(item.winning_team_id) : null,
      awarded_at: item.awarded_at ?? null,
      order: Number(item.order), tenant_id: item.tenant_id, organization_id: item.organization_id,
      created_at: item.created_at,
    }),
  },
  actions: {
    create: { commandId: 'sponsors.prizes.create', schema: rawBodySchema, mapInput: ({ parsed }) => parsed, response: ({ result }) => ({ id: String(result.id) }), status: 201 },
    update: { commandId: 'sponsors.prizes.update', schema: rawBodySchema, mapInput: ({ parsed }) => parsed, response: () => ({ ok: true }) },
    delete: { commandId: 'sponsors.prizes.delete', response: () => ({ ok: true }) },
  },
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Sponsors', summary: 'Prize management',
  methods: { GET: { summary: 'List prizes' }, POST: { summary: 'Create prize' }, PUT: { summary: 'Update prize' }, DELETE: { summary: 'Delete prize' } },
}
