import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { CompetitionInfoCard } from '../../data/entities'
import { competitionInfoCardCrudEvents, competitionInfoCardCrudIndexer } from '../../commands/info-cards'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'competitions:competition_info_card'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    competition_id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('sort_order'),
    sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
    organizationId: z.string().uuid().optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['competitions.view'] },
    POST: { requireAuth: true, requireFeatures: ['competitions.edit'] },
    PUT: { requireAuth: true, requireFeatures: ['competitions.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['competitions.edit'] },
  },
  orm: {
    entity: CompetitionInfoCard,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: { module: 'competitions', entity: 'competition_info_card', persistent: true },
  indexer: { entityType: ENTITY_ID },
  list: {
    schema: querySchema,
    entityId: ENTITY_ID,
    fields: ['id', 'competition_id', 'key', 'icon', 'label', 'value', 'sort_order', 'tenant_id', 'organization_id', 'created_at'],
    sortFieldMap: { id: 'id', key: 'key', label: 'label', sort_order: 'sort_order', created_at: 'created_at' },
    buildFilters: async (q) => {
      const filters: Record<string, unknown> = {}
      if (q.id) filters.id = q.id
      if (q.competition_id) filters.competition_id = q.competition_id
      if (q.organizationId) filters.organization_id = q.organizationId
      return filters
    },
    transformItem: (item) => {
      const r = item as Record<string, unknown>
      return {
        id: String(r.id),
        competition_id: String(r.competition_id),
        key: String(r.key),
        icon: r.icon ?? null,
        label: String(r.label ?? ''),
        value: String(r.value ?? ''),
        sort_order: Number(r.sort_order ?? 0),
        created_at: r.created_at,
      }
    },
  },
  actions: {
    create: {
      commandId: 'competitions.info_cards.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'competitions.info_cards.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'competitions.info_cards.delete',
      response: () => ({ ok: true }),
    },
  },
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Competition info card management',
  methods: {
    GET: { summary: 'List competition info cards' },
    POST: { summary: 'Create a competition info card' },
    PUT: { summary: 'Update a competition info card' },
    DELETE: { summary: 'Delete a competition info card' },
  },
}
