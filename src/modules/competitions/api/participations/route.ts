import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { CompetitionParticipation } from '../../data/entities'
import { participationCrudEvents, participationCrudIndexer } from '../../commands/participations'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'competitions:participation'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('created_at'),
    sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
    competition_id: z.string().uuid().optional(),
    role: z.string().optional(),
    checked_in: z.coerce.boolean().optional(),
    organizationId: z.string().uuid().optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['competitions.participants.manage'] },
    POST: { requireAuth: true, requireFeatures: ['competitions.participants.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['competitions.participants.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['competitions.participants.manage'] },
  },
  orm: {
    entity: CompetitionParticipation,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: { module: 'competitions', entity: 'participation', persistent: true },
  indexer: { entityType: ENTITY_ID },
  list: {
    schema: querySchema,
    entityId: ENTITY_ID,
    fields: ['id', 'competition_id', 'customer_user_id', 'role', 'checked_in', 'checked_in_at', 'coc_accepted', 'privacy_policy_accepted', 'profile_complete', 'looking_for_team', 'tenant_id', 'organization_id', 'created_at'],
    sortFieldMap: { id: 'id', role: 'role', checked_in: 'checked_in', created_at: 'created_at' },
    buildFilters: async (q) => {
      const filters: Record<string, unknown> = {}
      if (q.id) filters.id = q.id
      if (q.competition_id) filters.competition_id = q.competition_id
      if (q.role) filters.role = q.role
      if (q.checked_in !== undefined) filters.checked_in = q.checked_in
      if (q.organizationId) filters.organization_id = q.organizationId
      return filters
    },
    transformItem: (item) => ({
      id: String((item as Record<string, unknown>).id),
      competition_id: String((item as Record<string, unknown>).competition_id),
      customer_user_id: String((item as Record<string, unknown>).customer_user_id),
      role: String((item as Record<string, unknown>).role),
      checked_in: Boolean((item as Record<string, unknown>).checked_in),
      checked_in_at: (item as Record<string, unknown>).checked_in_at ?? null,
      coc_accepted: Boolean((item as Record<string, unknown>).coc_accepted),
      privacy_policy_accepted: Boolean((item as Record<string, unknown>).privacy_policy_accepted),
      profile_complete: Boolean((item as Record<string, unknown>).profile_complete),
      looking_for_team: Boolean((item as Record<string, unknown>).looking_for_team),
      created_at: (item as Record<string, unknown>).created_at,
    }),
  },
  actions: {
    create: {
      commandId: 'competitions.participations.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'competitions.participations.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'competitions.participations.delete',
      response: () => ({ ok: true }),
    },
  },
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Participation management',
  methods: {
    GET: { summary: 'List competition participations' },
    POST: { summary: 'Register a participant' },
    PUT: { summary: 'Update a participation' },
    DELETE: { summary: 'Remove a participation' },
  },
}
