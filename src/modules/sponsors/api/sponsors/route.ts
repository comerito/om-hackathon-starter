import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { Sponsor } from '../../data/entities'
import { sponsorListItemSchema as sponsorListItemDocSchema } from '../../data/validators'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import { sponsorCrudEvents, sponsorCrudIndexer } from '../../commands/sponsors'
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
    tier: z.enum(['TITLE', 'GOLD', 'SILVER', 'PARTNER', 'IN_KIND']).optional(),
    isVisible: z.coerce.boolean().optional(),
    isActive: z.coerce.boolean().optional(),
    format: z.enum(['json', 'csv']).optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

const id = 'id'
const competition_id = 'competition_id'
const name = 'name'
const tier = 'tier'
const logo_url = 'logo_url'
const website_url = 'website_url'
const description = 'description'
const challenge_title = 'challenge_title'
const challenge_description = 'challenge_description'
const challenge_resources_url = 'challenge_resources_url'
const contact_name = 'contact_name'
const contact_email = 'contact_email'
const order = 'order'
const is_visible = 'is_visible'
const is_active = 'is_active'
const created_at = 'created_at'
const updated_at = 'updated_at'

const listFields = [
  id, competition_id, name, tier, logo_url, website_url, description,
  challenge_title, challenge_description, challenge_resources_url,
  contact_name, contact_email, order, is_visible, is_active,
  created_at, updated_at,
]

const sortFieldMap: Record<string, unknown> = {
  id, name, tier, order, created_at, updated_at,
}

type BaseFields = {
  id: string
  competition_id: string
  name: string
  tier: string
  logo_url: string
  website_url: string | null
  description: string | null
  challenge_title: string | null
  challenge_description: string | null
  challenge_resources_url: string | null
  contact_name: string | null
  contact_email: string | null
  order: number
  is_visible: boolean
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['sponsors.view'] },
    POST: { requireAuth: true, requireFeatures: ['sponsors.create'] },
    PUT: { requireAuth: true, requireFeatures: ['sponsors.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['sponsors.delete'] },
  },
  orm: {
    entity: Sponsor,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
  },
  events: { module: 'sponsors', entity: 'sponsor', persistent: true },
  indexer: { entityType: 'sponsors:sponsor' },
  list: {
    schema: querySchema,
    fields: listFields,
    sortFieldMap,
    buildFilters: async (q: Query): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>
      if (q.id) F.id = q.id
      if (q.competitionId) F.competition_id = q.competitionId
      if (q.tier) F.tier = q.tier
      if (q.isVisible !== undefined) F.is_visible = q.isVisible
      if (q.isActive !== undefined) F.is_active = q.isActive
      return filters
    },
    transformItem: (item: BaseFields) => ({
      id: String(item.id),
      competition_id: String(item.competition_id),
      name: String(item.name),
      tier: String(item.tier),
      logo_url: String(item.logo_url),
      website_url: item.website_url ? String(item.website_url) : null,
      description: item.description ? String(item.description) : null,
      challenge_title: item.challenge_title ? String(item.challenge_title) : null,
      challenge_description: item.challenge_description ? String(item.challenge_description) : null,
      challenge_resources_url: item.challenge_resources_url ? String(item.challenge_resources_url) : null,
      contact_name: item.contact_name ? String(item.contact_name) : null,
      contact_email: item.contact_email ? String(item.contact_email) : null,
      order: item.order,
      is_visible: item.is_visible,
      is_active: item.is_active,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }),
  },
  actions: {
    create: {
      commandId: 'sponsors.sponsor.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'sponsors.sponsor.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'sponsors.sponsor.delete',
      response: () => ({ ok: true }),
    },
  },
})

const sponsorDeleteSchema = z.object({ id: z.string().uuid() })

export const openApi: OpenApiRouteDoc = createSponsorsCrudOpenApi({
  resourceName: 'Sponsor',
  pluralName: 'Sponsors',
  querySchema,
  listResponseSchema: createSponsorsPagedListResponseSchema(sponsorListItemDocSchema),
  create: {
    schema: rawBodySchema,
    description: 'Creates a new sponsor.',
    responseSchema: createdSchema,
  },
  update: {
    schema: rawBodySchema,
    description: 'Updates an existing sponsor by id.',
    responseSchema: okSchema,
  },
  del: {
    schema: sponsorDeleteSchema,
    description: 'Deletes a sponsor by id.',
    responseSchema: okSchema,
  },
})
