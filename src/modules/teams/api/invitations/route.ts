import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { TeamInvitation } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'teams:invitation'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('created_at'),
    sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
    team_id: z.string().uuid().optional(),
    invitee_id: z.string().uuid().optional(),
    status: z.string().optional(),
    organizationId: z.string().uuid().optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

export const { metadata, GET, POST, PUT } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['teams.view'] },
    POST: { requireAuth: true, requireFeatures: ['teams.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['teams.manage'] },
  },
  orm: {
    entity: TeamInvitation,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
  },
  events: { module: 'teams', entity: 'invitation', persistent: true },
  indexer: { entityType: ENTITY_ID },
  list: {
    schema: querySchema,
    entityId: ENTITY_ID,
    fields: ['id', 'team_id', 'inviter_id', 'invitee_id', 'type', 'status', 'message', 'created_at', 'responded_at', 'expires_at', 'competition_id', 'tenant_id', 'organization_id'],
    sortFieldMap: { id: 'id', status: 'status', created_at: 'created_at', expires_at: 'expires_at' },
    buildFilters: async (q) => {
      const filters: Record<string, unknown> = {}
      if (q.id) filters.id = q.id
      if (q.team_id) filters.team_id = q.team_id
      if (q.invitee_id) filters.invitee_id = q.invitee_id
      if (q.status) filters.status = q.status
      if (q.organizationId) filters.organization_id = q.organizationId
      return filters
    },
    transformItem: (item) => ({
      id: String((item as Record<string, unknown>).id),
      team_id: String((item as Record<string, unknown>).team_id),
      inviter_id: String((item as Record<string, unknown>).inviter_id),
      invitee_id: String((item as Record<string, unknown>).invitee_id),
      type: String((item as Record<string, unknown>).type),
      status: String((item as Record<string, unknown>).status),
      message: (item as Record<string, unknown>).message ?? null,
      created_at: (item as Record<string, unknown>).created_at,
      responded_at: (item as Record<string, unknown>).responded_at ?? null,
      expires_at: (item as Record<string, unknown>).expires_at,
      competition_id: String((item as Record<string, unknown>).competition_id),
    }),
  },
  actions: {
    create: {
      commandId: 'teams.invitations.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'teams.invitations.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
  },
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Teams',
  summary: 'Team invitation management',
  methods: {
    GET: { summary: 'List team invitations' },
    POST: { summary: 'Create a team invitation' },
    PUT: { summary: 'Update invitation status (accept/decline/cancel)' },
  },
}
