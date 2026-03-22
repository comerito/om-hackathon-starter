import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { JudgePanel } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'judging:judge_panel'
const querySchema = z.object({
  id: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  sortField: z.string().optional().default('name'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
  competition_id: z.string().uuid().optional(),
  round: z.string().optional(),
  organizationId: z.string().uuid().optional(),
}).passthrough()

const rawBodySchema = z.object({}).passthrough()
type Query = z.infer<typeof querySchema>

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['judging.view'] },
    POST: { requireAuth: true, requireFeatures: ['judging.panels.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['judging.panels.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['judging.panels.manage'] },
  },
  orm: { entity: JudgePanel, idField: 'id', orgField: 'organizationId', tenantField: 'tenantId', softDeleteField: 'deletedAt' },
  events: { module: 'judging', entity: 'panel', persistent: true },
  indexer: { entityType: ENTITY_ID },
  enrichers: { entityId: ENTITY_ID },
  list: {
    schema: querySchema, entityId: ENTITY_ID,
    fields: ['id', 'competition_id', 'name', 'round', 'tenant_id', 'organization_id', 'created_at'],
    sortFieldMap: { id: 'id', name: 'name', round: 'round', created_at: 'created_at' },
    buildFilters: async (q: Query) => {
      const f: Record<string, unknown> = {}
      if (q.id) f.id = q.id
      if (q.competition_id) f.competition_id = q.competition_id
      if (q.round) f.round = q.round
      if (q.organizationId) f.organization_id = q.organizationId
      return f
    },
    transformItem: (item: Record<string, unknown>) => ({
      id: String(item.id), competition_id: String(item.competition_id),
      name: String(item.name), round: String(item.round),
      tenant_id: item.tenant_id, organization_id: item.organization_id, created_at: item.created_at,
    }),
  },
  actions: {
    create: { commandId: 'judging.panels.create', schema: rawBodySchema, mapInput: ({ parsed }) => parsed, response: ({ result }) => ({ id: String(result.id) }), status: 201 },
    update: { commandId: 'judging.panels.update', schema: rawBodySchema, mapInput: ({ parsed }) => parsed, response: () => ({ ok: true }) },
    delete: { commandId: 'judging.panels.delete', response: () => ({ ok: true }) },
  },
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Judging', summary: 'Judge panel management',
  methods: { GET: { summary: 'List panels' }, POST: { summary: 'Create panel' }, PUT: { summary: 'Update panel' }, DELETE: { summary: 'Delete panel' } },
}
