import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { IncidentReport } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'incidents:incident_report'
const querySchema = z.object({
  id: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  sortField: z.string().optional().default('created_at'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  competition_id: z.string().uuid().optional(),
  severity: z.string().optional(),
  status: z.string().optional(),
  organizationId: z.string().uuid().optional(),
}).passthrough()

const rawBodySchema = z.object({}).passthrough()
type Query = z.infer<typeof querySchema>

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['incidents.view'] },
    POST: { requireAuth: true, requireFeatures: ['incidents.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['incidents.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['incidents.manage'] },
  },
  orm: { entity: IncidentReport, idField: 'id', orgField: 'organizationId', tenantField: 'tenantId' },
  events: { module: 'incidents', entity: 'report', persistent: true },
  indexer: { entityType: ENTITY_ID },
  enrichers: { entityId: ENTITY_ID },
  list: {
    schema: querySchema, entityId: ENTITY_ID,
    fields: ['id', 'competition_id', 'reporter_id', 'reported_user_id', 'description', 'severity', 'status',
      'admin_notes', 'resolved_by', 'resolution_description', 'resolved_at',
      'tenant_id', 'organization_id', 'created_at', 'updated_at'],
    sortFieldMap: { id: 'id', severity: 'severity', status: 'status', created_at: 'created_at' },
    buildFilters: async (q: Query) => {
      const f: Record<string, unknown> = {}
      if (q.id) f.id = q.id
      if (q.competition_id) f.competition_id = q.competition_id
      if (q.severity) f.severity = q.severity
      if (q.status) f.status = q.status
      if (q.organizationId) f.organization_id = q.organizationId
      return f
    },
    transformItem: (item: Record<string, unknown>) => ({
      id: String(item.id), competition_id: String(item.competition_id),
      reporter_id: item.reporter_id ? String(item.reporter_id) : null,
      reported_user_id: item.reported_user_id ? String(item.reported_user_id) : null,
      description: String(item.description), severity: String(item.severity), status: String(item.status),
      admin_notes: item.admin_notes ?? null,
      resolved_by: item.resolved_by ? String(item.resolved_by) : null,
      resolution_description: item.resolution_description ?? null,
      resolved_at: item.resolved_at ?? null,
      tenant_id: item.tenant_id, organization_id: item.organization_id,
      created_at: item.created_at, updated_at: item.updated_at,
    }),
  },
  actions: {
    create: { commandId: 'incidents.incidents.create', schema: rawBodySchema, mapInput: ({ parsed }) => parsed, response: ({ result }) => ({ id: String(result.id) }), status: 201 },
    update: { commandId: 'incidents.incidents.update', schema: rawBodySchema, mapInput: ({ parsed }) => parsed, response: () => ({ ok: true }) },
  },
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Incidents', summary: 'Incident management',
  methods: { GET: { summary: 'List incidents' }, POST: { summary: 'Create incident (admin)' }, PUT: { summary: 'Update incident' } },
}
