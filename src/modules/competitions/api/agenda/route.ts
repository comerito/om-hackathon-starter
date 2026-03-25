import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { AgendaItem } from '../../data/entities'
import { agendaCrudEvents, agendaCrudIndexer } from '../../commands/agenda'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'competitions:agenda_item'

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('starts_at'),
    sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
    competition_id: z.string().uuid().optional(),
    type: z.string().optional(),
    organizationId: z.string().uuid().optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['competitions.view'] },
    POST: { requireAuth: true, requireFeatures: ['competitions.agenda.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['competitions.agenda.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['competitions.agenda.manage'] },
  },
  orm: {
    entity: AgendaItem,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: { module: 'competitions', entity: 'agenda_item', persistent: true },
  indexer: { entityType: ENTITY_ID },
  list: {
    schema: querySchema,
    entityId: ENTITY_ID,
    fields: ['id', 'competition_id', 'title', 'description', 'type', 'starts_at', 'ends_at', 'location', 'speaker_name', 'speaker_bio', 'speaker_photo_url', 'is_mandatory', 'sort_order', 'track_id', 'tenant_id', 'organization_id', 'created_at'],
    sortFieldMap: { id: 'id', title: 'title', starts_at: 'starts_at', ends_at: 'ends_at', sort_order: 'sort_order', type: 'type', created_at: 'created_at' },
    buildFilters: async (q) => {
      const filters: Record<string, unknown> = {}
      if (q.id) filters.id = q.id
      if (q.competition_id) filters.competition_id = q.competition_id
      if (q.type) filters.type = q.type
      if (q.organizationId) filters.organization_id = q.organizationId
      return filters
    },
    transformItem: (item) => {
      const r = item as Record<string, unknown>
      return {
        id: String(r.id),
        competition_id: String(r.competition_id),
        title: String(r.title),
        description: r.description ?? null,
        type: String(r.type),
        starts_at: r.starts_at,
        ends_at: r.ends_at,
        location: r.location ?? null,
        speaker_name: r.speaker_name ?? null,
        speaker_bio: r.speaker_bio ?? null,
        speaker_photo_url: r.speaker_photo_url ?? null,
        is_mandatory: Boolean(r.is_mandatory),
        order: Number(r.sort_order ?? 0),
        track_id: r.track_id ?? null,
        created_at: r.created_at,
      }
    },
  },
  actions: {
    create: {
      commandId: 'competitions.agenda.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'competitions.agenda.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'competitions.agenda.delete',
      response: () => ({ ok: true }),
    },
  },
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Agenda item management',
  methods: {
    GET: { summary: 'List agenda items' },
    POST: { summary: 'Create an agenda item' },
    PUT: { summary: 'Update an agenda item' },
    DELETE: { summary: 'Delete an agenda item' },
  },
}
