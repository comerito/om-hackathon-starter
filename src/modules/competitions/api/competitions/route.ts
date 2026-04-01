import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { Competition } from '../../data/entities'
import { competitionCrudEvents, competitionCrudIndexer } from '../../commands/competitions'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'competitions:competition'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('name'),
    sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
    name: z.string().optional(),
    stage: z.string().optional(),
    organizationId: z.string().uuid().optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

type BaseFields = {
  id: string
  name: string
  slug: string
  description: string | null
  stage: string
  starts_at: Date
  ends_at: Date
  location: string | null
  timezone: string
  min_team_size: number
  max_team_size: number
  max_tracks_per_team: number
  code_of_conduct_url: string | null
  code_of_conduct_content: string | null
  rules_url: string | null
  rules_content: string | null
  privacy_policy_url: string | null
  privacy_policy_content: string | null
  cover_image_url: string | null
  tenant_id: string
  organization_id: string
  is_active: boolean
  created_at: Date
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['competitions.view'] },
    POST: { requireAuth: true, requireFeatures: ['competitions.create'] },
    PUT: { requireAuth: true, requireFeatures: ['competitions.edit'] },
    DELETE: { requireAuth: true, requireFeatures: ['competitions.delete'] },
  },
  orm: {
    entity: Competition,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: { module: 'competitions', entity: 'competition', persistent: true },
  indexer: { entityType: ENTITY_ID },
  list: {
    schema: querySchema,
    entityId: ENTITY_ID,
    fields: [
      'id',
      'name',
      'slug',
      'description',
      'stage',
      'starts_at',
      'ends_at',
      'location',
      'timezone',
      'min_team_size',
      'max_team_size',
      'max_tracks_per_team',
      'code_of_conduct_url',
      'code_of_conduct_content',
      'rules_url',
      'rules_content',
      'privacy_policy_url',
      'privacy_policy_content',
      'cover_image_url',
      'tenant_id',
      'organization_id',
      'is_active',
      'created_at',
    ],
    sortFieldMap: { id: 'id', name: 'name', slug: 'slug', stage: 'stage', starts_at: 'starts_at', ends_at: 'ends_at', created_at: 'created_at' },
    buildFilters: async (q: Query) => {
      const filters: Record<string, unknown> = {}
      if (q.id) filters.id = q.id
      if (q.name) filters.name = { $ilike: `%${q.name}%` }
      if (q.stage) filters.stage = q.stage
      if (q.organizationId) filters.organization_id = q.organizationId
      return filters
    },
    transformItem: (item: BaseFields) => ({
      id: String(item.id),
      name: String(item.name),
      slug: String(item.slug),
      description: item.description,
      stage: String(item.stage),
      starts_at: item.starts_at,
      ends_at: item.ends_at,
      location: item.location,
      timezone: String(item.timezone),
      min_team_size: Number(item.min_team_size),
      max_team_size: Number(item.max_team_size),
      max_tracks_per_team: Number(item.max_tracks_per_team),
      code_of_conduct_url: item.code_of_conduct_url,
      code_of_conduct_content: item.code_of_conduct_content,
      rules_url: item.rules_url,
      rules_content: item.rules_content,
      privacy_policy_url: item.privacy_policy_url,
      privacy_policy_content: item.privacy_policy_content,
      cover_image_url: item.cover_image_url,
      tenant_id: item.tenant_id,
      organization_id: item.organization_id,
      is_active: Boolean(item.is_active),
      created_at: item.created_at,
    }),
  },
  actions: {
    create: {
      commandId: 'competitions.competitions.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'competitions.competitions.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'competitions.competitions.delete',
      response: () => ({ ok: true }),
    },
  },
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Competition management',
  methods: {
    GET: { summary: 'List competitions' },
    POST: { summary: 'Create a competition' },
    PUT: { summary: 'Update a competition' },
    DELETE: { summary: 'Delete a competition' },
  },
}
