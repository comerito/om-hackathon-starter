import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { Milestone } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'competitions:milestone'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('sort_order'),
    sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
    competition_id: z.string().uuid().optional(),
    status: z.string().optional(),
    organizationId: z.string().uuid().optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true },
    POST: { requireAuth: true },
    PUT: { requireAuth: true },
    DELETE: { requireAuth: true },
  },
  orm: {
    entity: Milestone,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
  },
  list: {
    schema: querySchema,
    entityId: ENTITY_ID,
    fields: ['id', 'competition_id', 'name', 'description', 'due_date', 'status', 'sort_order', 'tenant_id', 'organization_id', 'created_at'],
    sortFieldMap: { id: 'id', name: 'name', due_date: 'due_date', status: 'status', sort_order: 'sort_order', created_at: 'created_at' },
    buildFilters: async (q) => {
      const filters: Record<string, unknown> = {}
      if (q.id) filters.id = q.id
      if (q.competition_id) filters.competition_id = q.competition_id
      if (q.status) filters.status = q.status
      if (q.organizationId) filters.organization_id = q.organizationId
      return filters
    },
    transformItem: (item) => {
      const r = item as Record<string, unknown>
      return {
        id: String(r.id),
        competition_id: String(r.competition_id),
        name: String(r.name),
        description: r.description ?? null,
        due_date: r.due_date,
        status: String(r.status),
        sort_order: Number(r.sort_order ?? 0),
        created_at: r.created_at,
      }
    },
  },
  actions: {
    create: {
      commandId: 'competitions.milestones.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'competitions.milestones.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'competitions.milestones.delete',
      response: () => ({ ok: true }),
    },
  },
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Milestone management',
  methods: {
    GET: { summary: 'List milestones' },
    POST: { summary: 'Create a milestone' },
    PUT: { summary: 'Update a milestone' },
    DELETE: { summary: 'Delete a milestone' },
  },
}
