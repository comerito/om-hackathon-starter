import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { Announcement } from '../../data/entities'
import { announcementListItemSchema, announcementPrioritySchema } from '../../data/validators'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import { announcementCrudEvents, announcementCrudIndexer } from '../../commands/announcements'
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
    sortField: z.string().optional().default('published_at'),
    sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
    competitionId: z.string().uuid().optional(),
    priority: announcementPrioritySchema.optional(),
    pinned: z.coerce.boolean().optional(),
    organizationId: z.string().uuid().optional(),
    format: z.enum(['json', 'csv']).optional(),
  })
  .passthrough()

// Create schema — passthrough so the command layer does full validation
const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

// Column references
const id = 'id'
const competition_id = 'competition_id'
const author_id = 'author_id'
const title = 'title'
const content = 'content'
const priority = 'priority'
const target_roles = 'target_roles'
const target_track_ids = 'target_track_ids'
const pinned = 'pinned'
const published_at = 'published_at'
const created_at = 'created_at'
const tenant_id = 'tenant_id'
const organization_id = 'organization_id'

const listFields = [
  id, competition_id, author_id, title, content, priority,
  target_roles, target_track_ids, pinned, published_at, created_at,
]

const sortFieldMap: Record<string, unknown> = {
  id,
  title,
  priority,
  published_at,
  created_at,
  pinned,
  tenant_id,
  organization_id,
}

type BaseFields = {
  id: string
  competition_id: string
  author_id: string
  title: string
  content: string
  priority: string
  target_roles: string[]
  target_track_ids: string[]
  pinned: boolean
  published_at: Date
  created_at: Date
}

export const { metadata, GET, POST, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['competitions.view'] },
    POST: { requireAuth: true, requireFeatures: ['competitions.announcements.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['competitions.announcements.manage'] },
  },
  orm: {
    entity: Announcement,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
  },
  events: { module: 'competitions', entity: 'announcement', persistent: true },
  indexer: { entityType: 'competitions:announcement' },
  list: {
    schema: querySchema,
    fields: listFields,
    sortFieldMap,
    buildFilters: async (q: Query): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>
      if (q.id) F.id = q.id
      if (q.competitionId) F.competition_id = q.competitionId
      if (q.priority) F.priority = q.priority
      if (q.pinned !== undefined) F.pinned = q.pinned
      if (q.organizationId) F.organization_id = q.organizationId
      return filters
    },
    transformItem: (item: BaseFields) => ({
      id: String(item.id),
      competition_id: String(item.competition_id),
      author_id: String(item.author_id),
      title: String(item.title),
      content: String(item.content),
      priority: String(item.priority),
      target_roles: item.target_roles,
      target_track_ids: item.target_track_ids,
      pinned: item.pinned,
      published_at: item.published_at,
      created_at: item.created_at,
    }),
  },
  actions: {
    create: {
      commandId: 'competitions.announcement.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    delete: {
      commandId: 'competitions.announcement.delete',
      response: () => ({ ok: true }),
    },
  },
})

const announcementDeleteSchema = z.object({
  id: z.string().uuid(),
})

export const openApi: OpenApiRouteDoc = createCompetitionsCrudOpenApi({
  resourceName: 'Announcement',
  pluralName: 'Announcements',
  querySchema,
  listResponseSchema: createCompetitionsPagedListResponseSchema(announcementListItemSchema),
  create: {
    schema: rawBodySchema,
    description: 'Creates a new announcement for a competition.',
    responseSchema: createdSchema,
  },
  del: {
    schema: announcementDeleteSchema,
    description: 'Deletes an announcement by id.',
    responseSchema: okSchema,
  },
})
