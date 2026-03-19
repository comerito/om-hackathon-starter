import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { Announcement } from '../../data/entities'
import { announcementCrudEvents, announcementCrudIndexer } from '../../commands/announcements'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'competitions:announcement'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('created_at'),
    sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
    competition_id: z.string().uuid().optional(),
    priority: z.string().optional(),
    organizationId: z.string().uuid().optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['competitions.view'] },
    POST: { requireAuth: true, requireFeatures: ['competitions.announcements.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['competitions.announcements.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['competitions.announcements.manage'] },
  },
  orm: {
    entity: Announcement,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
  },
  events: { module: 'competitions', entity: 'announcement', persistent: true },
  indexer: { entityType: ENTITY_ID },
  list: {
    schema: querySchema,
    entityId: ENTITY_ID,
    fields: ['id', 'competition_id', 'author_id', 'title', 'content', 'priority', 'target_roles', 'target_track_ids', 'pinned', 'published_at', 'tenant_id', 'organization_id', 'created_at'],
    sortFieldMap: { id: 'id', title: 'title', priority: 'priority', published_at: 'published_at', created_at: 'created_at' },
    buildFilters: async (q) => {
      const filters: Record<string, unknown> = {}
      if (q.id) filters.id = q.id
      if (q.competition_id) filters.competition_id = q.competition_id
      if (q.priority) filters.priority = q.priority
      if (q.organizationId) filters.organization_id = q.organizationId
      return filters
    },
    transformItem: (item) => {
      const r = item as Record<string, unknown>
      return {
        id: String(r.id),
        competition_id: String(r.competition_id),
        author_id: String(r.author_id),
        title: String(r.title),
        content: String(r.content),
        priority: String(r.priority),
        target_roles: r.target_roles ?? [],
        target_track_ids: r.target_track_ids ?? [],
        pinned: Boolean(r.pinned),
        published_at: r.published_at,
        created_at: r.created_at,
      }
    },
  },
  actions: {
    create: {
      commandId: 'competitions.announcements.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    delete: {
      commandId: 'competitions.announcements.delete',
      response: () => ({ ok: true }),
    },
  },
})

export const openApi: OpenApiRouteDoc = {
  GET: { summary: 'List announcements', tags: ['Competitions'] },
  POST: { summary: 'Create an announcement', tags: ['Competitions'] },
  DELETE: { summary: 'Delete an announcement', tags: ['Competitions'] },
}
