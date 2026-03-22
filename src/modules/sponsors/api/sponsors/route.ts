import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { Sponsor } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'sponsors:sponsor'
const querySchema = z.object({
  id: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  sortField: z.string().optional().default('order'),
  sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
  competition_id: z.string().uuid().optional(),
  tier: z.string().optional(),
  organizationId: z.string().uuid().optional(),
}).passthrough()

const rawBodySchema = z.object({}).passthrough()
type Query = z.infer<typeof querySchema>

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['sponsors.view'] },
    POST: { requireAuth: true, requireFeatures: ['sponsors.create'] },
    PUT: { requireAuth: true, requireFeatures: ['sponsors.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['sponsors.delete'] },
  },
  orm: { entity: Sponsor, idField: 'id', orgField: 'organizationId', tenantField: 'tenantId', softDeleteField: 'deletedAt' },
  events: { module: 'sponsors', entity: 'sponsor', persistent: true },
  indexer: { entityType: ENTITY_ID },
  list: {
    schema: querySchema, entityId: ENTITY_ID,
    fields: ['id', 'competition_id', 'name', 'tier', 'logo_url', 'website_url', 'description',
      'challenge_title', 'is_visible', 'order', 'tenant_id', 'organization_id', 'is_active', 'created_at'],
    sortFieldMap: { id: 'id', name: 'name', tier: 'tier', order: 'order', created_at: 'created_at' },
    buildFilters: async (q: Query) => {
      const f: Record<string, unknown> = {}
      if (q.id) f.id = q.id
      if (q.competition_id) f.competition_id = q.competition_id
      if (q.tier) f.tier = q.tier
      if (q.organizationId) f.organization_id = q.organizationId
      return f
    },
    transformItem: (item: Record<string, unknown>) => ({
      id: String(item.id), competition_id: String(item.competition_id),
      name: String(item.name), tier: String(item.tier),
      logo_url: String(item.logo_url ?? ''), website_url: item.website_url ?? null,
      description: item.description ?? null, challenge_title: item.challenge_title ?? null,
      is_visible: Boolean(item.is_visible), order: Number(item.order),
      tenant_id: item.tenant_id, organization_id: item.organization_id,
      is_active: Boolean(item.is_active), created_at: item.created_at,
    }),
  },
  actions: {
    create: { commandId: 'sponsors.sponsors.create', schema: rawBodySchema, mapInput: ({ parsed }) => parsed, response: ({ result }) => ({ id: String(result.id) }), status: 201 },
    update: { commandId: 'sponsors.sponsors.update', schema: rawBodySchema, mapInput: ({ parsed }) => parsed, response: () => ({ ok: true }) },
    delete: { commandId: 'sponsors.sponsors.delete', response: () => ({ ok: true }) },
  },
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Sponsors', summary: 'Sponsor management',
  methods: { GET: { summary: 'List sponsors' }, POST: { summary: 'Create sponsor' }, PUT: { summary: 'Update sponsor' }, DELETE: { summary: 'Delete sponsor' } },
}
