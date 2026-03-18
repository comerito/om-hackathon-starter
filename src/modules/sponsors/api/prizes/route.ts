import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { Prize } from '../../data/entities'
import { prizeListItemSchema as prizeListItemDocSchema } from '../../data/validators'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import { prizeCrudEvents, prizeCrudIndexer } from '../../commands/sponsors'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  createSponsorsCrudOpenApi,
  createSponsorsPagedListResponseSchema,
  createdSchema,
  okSchema,
} from '../openapi'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('order'),
    sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
    competitionId: z.string().uuid().optional(),
    category: z.enum(['TRACK_PLACEMENT', 'SPECIAL_AWARD', 'SPONSOR_PRIZE', 'PEOPLES_CHOICE']).optional(),
    trackId: z.string().uuid().optional(),
    sponsorId: z.string().uuid().optional(),
    awarded: z.coerce.boolean().optional(),
    format: z.enum(['json', 'csv']).optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

const id = 'id'
const competition_id = 'competition_id'
const name = 'name'
const description = 'description'
const category = 'category'
const track_id = 'track_id'
const sponsor_id = 'sponsor_id'
const value = 'value'
const rank = 'rank'
const icon_url = 'icon_url'
const winning_project_id = 'winning_project_id'
const winning_team_id = 'winning_team_id'
const awarded_at = 'awarded_at'
const awarded_by = 'awarded_by'
const order = 'order'
const created_at = 'created_at'
const updated_at = 'updated_at'

const listFields = [
  id, competition_id, name, description, category, track_id, sponsor_id,
  value, rank, icon_url, winning_project_id, winning_team_id,
  awarded_at, awarded_by, order, created_at, updated_at,
]

const sortFieldMap: Record<string, unknown> = {
  id, name, category, rank, order, created_at, updated_at,
}

type BaseFields = {
  id: string
  competition_id: string
  name: string
  description: string | null
  category: string
  track_id: string | null
  sponsor_id: string | null
  value: string | null
  rank: number | null
  icon_url: string | null
  winning_project_id: string | null
  winning_team_id: string | null
  awarded_at: Date | null
  awarded_by: string | null
  order: number
  created_at: Date
  updated_at: Date
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: false },
    POST: { requireAuth: true, requireFeatures: ['sponsors.prizes.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['sponsors.prizes.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['sponsors.prizes.manage'] },
  },
  orm: {
    entity: Prize,
    idField: 'id',
  },
  events: { module: 'sponsors', entity: 'prize', persistent: true },
  indexer: { entityType: 'sponsors:prize' },
  list: {
    entityId: E.sponsors.prize,
    schema: querySchema,
    fields: listFields,
    sortFieldMap,
    buildFilters: async (q: Query): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>
      if (q.id) F.id = q.id
      if (q.competitionId) F.competition_id = q.competitionId
      if (q.category) F.category = q.category
      if (q.trackId) F.track_id = q.trackId
      if (q.sponsorId) F.sponsor_id = q.sponsorId
      if (q.awarded !== undefined) {
        if (q.awarded) {
          F.winning_project_id = { $ne: null } as unknown as WhereValue
        } else {
          F.winning_project_id = null as unknown as WhereValue
        }
      }
      return filters
    },
    transformItem: (item: BaseFields) => ({
      id: String(item.id),
      competition_id: String(item.competition_id),
      name: String(item.name),
      description: item.description ? String(item.description) : null,
      category: String(item.category),
      track_id: item.track_id ? String(item.track_id) : null,
      sponsor_id: item.sponsor_id ? String(item.sponsor_id) : null,
      value: item.value ? String(item.value) : null,
      rank: item.rank,
      icon_url: item.icon_url ? String(item.icon_url) : null,
      winning_project_id: item.winning_project_id ? String(item.winning_project_id) : null,
      winning_team_id: item.winning_team_id ? String(item.winning_team_id) : null,
      awarded_at: item.awarded_at,
      awarded_by: item.awarded_by ? String(item.awarded_by) : null,
      order: item.order,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }),
  },
  actions: {
    create: {
      commandId: 'sponsors.prize.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'sponsors.prize.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'sponsors.prize.delete',
      response: () => ({ ok: true }),
    },
  },
})

const prizeDeleteSchema = z.object({ id: z.string().uuid() })

export const openApi: OpenApiRouteDoc = createSponsorsCrudOpenApi({
  resourceName: 'Prize',
  pluralName: 'Prizes',
  querySchema,
  listResponseSchema: createSponsorsPagedListResponseSchema(prizeListItemDocSchema),
  create: {
    schema: rawBodySchema,
    description: 'Creates a new prize.',
    responseSchema: createdSchema,
  },
  update: {
    schema: rawBodySchema,
    description: 'Updates an existing prize by id.',
    responseSchema: okSchema,
  },
  del: {
    schema: prizeDeleteSchema,
    description: 'Deletes a prize by id.',
    responseSchema: okSchema,
  },
})
