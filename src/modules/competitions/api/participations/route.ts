import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { CompetitionParticipation } from '../../data/entities'
import { participationListItemSchema, participationRoleSchema } from '../../data/validators'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import { participationCrudEvents, participationCrudIndexer } from '../../commands/participations'
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
    competitionId: z.string().uuid().optional(),
    customerUserId: z.string().uuid().optional(),
    role: participationRoleSchema.optional(),
    checkedIn: z.coerce.boolean().optional(),
    cocAccepted: z.coerce.boolean().optional(),
    lookingForTeam: z.coerce.boolean().optional(),
    organizationId: z.string().uuid().optional(),
    format: z.enum(['json', 'csv']).optional(),
  })
  .passthrough()

// Create/Update schemas — passthrough so the command layer does full validation
const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

// Column references
const id = 'id'
const competition_id = 'competition_id'
const customer_user_id = 'customer_user_id'
const role = 'role'
const checked_in = 'checked_in'
const checked_in_at = 'checked_in_at'
const coc_accepted = 'coc_accepted'
const privacy_policy_accepted = 'privacy_policy_accepted'
const looking_for_team = 'looking_for_team'
const looking_for_team_description = 'looking_for_team_description'
const profile_complete = 'profile_complete'
const badge_printed = 'badge_printed'
const created_at = 'created_at'
const tenant_id = 'tenant_id'
const organization_id = 'organization_id'

const listFields = [
  id, competition_id, customer_user_id, role, checked_in, checked_in_at,
  badge_printed, coc_accepted, privacy_policy_accepted,
  looking_for_team, looking_for_team_description, profile_complete, created_at,
]

const sortFieldMap: Record<string, unknown> = {
  id,
  competition_id,
  customer_user_id,
  role,
  checked_in,
  coc_accepted,
  looking_for_team,
  created_at,
  tenant_id,
  organization_id,
}

type BaseFields = {
  id: string
  competition_id: string
  customer_user_id: string
  role: string
  checked_in: boolean
  checked_in_at: Date | null
  badge_printed: boolean
  coc_accepted: boolean
  privacy_policy_accepted: boolean
  looking_for_team: boolean
  looking_for_team_description: string | null
  profile_complete: boolean
  created_at: Date
}

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
  },
  events: { module: 'competitions', entity: 'participation', persistent: true },
  indexer: { entityType: 'competitions:participation' },
  list: {
    schema: querySchema,
    fields: listFields,
    sortFieldMap,
    buildFilters: async (q: Query): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>
      if (q.id) F.id = q.id
      if (q.competitionId) F.competition_id = q.competitionId
      if (q.customerUserId) F.customer_user_id = q.customerUserId
      if (q.role) F.role = q.role
      if (q.checkedIn !== undefined) F.checked_in = q.checkedIn
      if (q.cocAccepted !== undefined) F.coc_accepted = q.cocAccepted
      if (q.lookingForTeam !== undefined) F.looking_for_team = q.lookingForTeam
      if (q.organizationId) F.organization_id = q.organizationId
      return filters
    },
    transformItem: (item: BaseFields) => ({
      id: String(item.id),
      competition_id: String(item.competition_id),
      customer_user_id: String(item.customer_user_id),
      role: String(item.role),
      checked_in: item.checked_in,
      checked_in_at: item.checked_in_at,
      badge_printed: item.badge_printed,
      coc_accepted: item.coc_accepted,
      privacy_policy_accepted: item.privacy_policy_accepted,
      looking_for_team: item.looking_for_team,
      looking_for_team_description: item.looking_for_team_description,
      profile_complete: item.profile_complete,
      created_at: item.created_at,
    }),
    allowCsv: true,
    csv: {
      headers: ['id', 'competition_id', 'customer_user_id', 'role', 'checked_in', 'coc_accepted', 'looking_for_team', 'created_at'],
      row: (item: Record<string, unknown>) => [
        item.id ?? '',
        item.competition_id ?? '',
        item.customer_user_id ?? '',
        item.role ?? '',
        item.checked_in ? 'true' : 'false',
        item.coc_accepted ? 'true' : 'false',
        item.looking_for_team ? 'true' : 'false',
        item.created_at ? String(item.created_at) : '',
      ],
      filename: 'participations.csv',
    },
  },
  actions: {
    create: {
      commandId: 'competitions.participation.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'competitions.participation.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'competitions.participation.delete',
      response: () => ({ ok: true }),
    },
  },
})

const participationDeleteSchema = z.object({
  id: z.string().uuid(),
})

export const openApi: OpenApiRouteDoc = createCompetitionsCrudOpenApi({
  resourceName: 'Participation',
  pluralName: 'Participations',
  querySchema,
  listResponseSchema: createCompetitionsPagedListResponseSchema(participationListItemSchema),
  create: {
    schema: rawBodySchema,
    description: 'Registers a participant for a competition.',
    responseSchema: createdSchema,
  },
  update: {
    schema: rawBodySchema,
    description: 'Updates a participation record.',
    responseSchema: okSchema,
  },
  del: {
    schema: participationDeleteSchema,
    description: 'Deletes a participation record.',
    responseSchema: okSchema,
  },
})
