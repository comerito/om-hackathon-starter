import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { IncidentReport } from '../../data/entities'
import { incidentListItemSchema as incidentListItemDocSchema, listIncidentQuerySchema } from '../../data/validators'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import { incidentCrudEvents, incidentCrudIndexer } from '../../commands/incidents'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  createIncidentsCrudOpenApi,
  createIncidentsPagedListResponseSchema,
  createdSchema,
  okSchema,
} from '../openapi'

type Query = z.infer<typeof listIncidentQuerySchema>

const rawBodySchema = z.object({}).passthrough()

const id = 'id'
const competition_id = 'competition_id'
const reporter_id = 'reporter_id'
const reported_user_id = 'reported_user_id'
const description = 'description'
const severity = 'severity'
const status = 'status'
const admin_notes = 'admin_notes'
const resolved_by = 'resolved_by'
const resolution_description = 'resolution_description'
const resolved_at = 'resolved_at'
const created_at = 'created_at'
const updated_at = 'updated_at'

const listFields = [
  id, competition_id, reporter_id, reported_user_id, description,
  severity, status, admin_notes, resolved_by, resolution_description,
  resolved_at, created_at, updated_at,
]

const sortFieldMap: Record<string, unknown> = {
  id, severity, status, created_at, updated_at,
}

type BaseFields = {
  id: string
  competition_id: string
  reporter_id: string | null
  reported_user_id: string | null
  description: string
  severity: string
  status: string
  admin_notes: string | null
  resolved_by: string | null
  resolution_description: string | null
  resolved_at: Date | null
  created_at: Date
  updated_at: Date
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: false },
    POST: { requireCustomerAuth: true },
    PUT: { requireAuth: true, requireFeatures: ['incidents.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['incidents.manage'] },
  },
  orm: {
    entity: IncidentReport,
    idField: 'id',
  },
  events: { module: 'incidents', entity: 'report', persistent: true },
  indexer: { entityType: 'incidents:report' },
  list: {
    entityId: E.incidents.incident_report,
    schema: listIncidentQuerySchema,
    fields: listFields,
    sortFieldMap,
    buildFilters: async (q: Query): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>
      if (q.id) F.id = q.id
      if (q.competitionId) F.competition_id = q.competitionId
      if (q.severity) F.severity = q.severity
      if (q.status) F.status = q.status
      return filters
    },
    transformItem: (item: BaseFields) => ({
      id: String(item.id),
      competition_id: String(item.competition_id),
      reporter_id: item.reporter_id ? String(item.reporter_id) : null,
      reported_user_id: item.reported_user_id ? String(item.reported_user_id) : null,
      description: String(item.description),
      severity: String(item.severity),
      status: String(item.status),
      admin_notes: item.admin_notes ? String(item.admin_notes) : null,
      resolved_by: item.resolved_by ? String(item.resolved_by) : null,
      resolution_description: item.resolution_description ? String(item.resolution_description) : null,
      resolved_at: item.resolved_at,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }),
  },
  actions: {
    create: {
      commandId: 'incidents.report.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'incidents.report.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'incidents.report.delete',
      response: () => ({ ok: true }),
    },
  },
})

const incidentDeleteSchema = z.object({ id: z.string().uuid() })

export const openApi: OpenApiRouteDoc = createIncidentsCrudOpenApi({
  resourceName: 'Incident Report',
  pluralName: 'Incident Reports',
  querySchema: listIncidentQuerySchema,
  listResponseSchema: createIncidentsPagedListResponseSchema(incidentListItemDocSchema),
  create: {
    schema: rawBodySchema,
    description: 'Creates a new incident report. Can be submitted anonymously.',
    responseSchema: createdSchema,
  },
  update: {
    schema: rawBodySchema,
    description: 'Updates an existing incident report by id.',
    responseSchema: okSchema,
  },
  del: {
    schema: incidentDeleteSchema,
    description: 'Deletes an incident report by id.',
    responseSchema: okSchema,
  },
})
