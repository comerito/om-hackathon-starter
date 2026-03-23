import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { FilterQuery } from '@mikro-orm/postgresql'
import { IncidentReport, IncidentStatus } from '../data/entities'
import { createIncidentSchema, updateIncidentSchema, resolveIncidentSchema } from '../data/validators'

const ENTITY_ID = 'incidents:incident_report'

export const incidentCrudEvents: CrudEventsConfig<IncidentReport> = {
  module: 'incidents', entity: 'report', persistent: true,
  buildPayload: (ctx: CrudEmitContext<IncidentReport>) => ({
    id: ctx.identifiers.id, tenantId: ctx.identifiers.tenantId, organizationId: ctx.identifiers.organizationId,
  }),
}

export const incidentCrudIndexer: CrudIndexerConfig<IncidentReport> = {
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<IncidentReport>) => ({ entityType: ENTITY_ID, recordId: ctx.identifiers.id, tenantId: ctx.identifiers.tenantId, organizationId: ctx.identifiers.organizationId }),
  buildDeletePayload: (ctx: CrudEmitContext<IncidentReport>) => ({ entityType: ENTITY_ID, recordId: ctx.identifiers.id, tenantId: ctx.identifiers.tenantId, organizationId: ctx.identifiers.organizationId }),
}

function ensureScope(ctx: CommandRuntimeContext) {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}

registerCommand({
  id: 'incidents.incidents.create',
  async execute(rawInput, ctx) {
    const parsed = createIncidentSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const report = await de.createOrmEntity({ entity: IncidentReport, data: {
      competitionId: parsed.competition_id,
      reporterId: parsed.anonymous ? null : (ctx.auth?.sub ?? ctx.auth?.userId ?? null),
      reportedUserId: parsed.reported_user_id ?? null,
      description: parsed.description,
      severity: parsed.severity,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    }})
    await emitCrudSideEffects({ dataEngine: de, action: 'created', entity: report,
      identifiers: { id: String(report.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: incidentCrudEvents, indexer: incidentCrudIndexer })
    return report
  },
} as CommandHandler<Record<string, unknown>, IncidentReport>)

registerCommand({
  id: 'incidents.incidents.update',
  async execute(rawInput, ctx) {
    const parsed = updateIncidentSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const report = await de.updateOrmEntity({ entity: IncidentReport,
      where: { id: parsed.id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<IncidentReport>,
      apply: (e) => {
        if (parsed.status !== undefined) e.status = parsed.status
        if (parsed.admin_notes !== undefined) e.adminNotes = parsed.admin_notes
        if (parsed.severity !== undefined) e.severity = parsed.severity
      },
    })
    if (!report) throw new CrudHttpError(404, { error: 'Incident not found' })
    await emitCrudSideEffects({ dataEngine: de, action: 'updated', entity: report,
      identifiers: { id: String(report.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: incidentCrudEvents, indexer: incidentCrudIndexer })
    return report
  },
} as CommandHandler<Record<string, unknown>, IncidentReport>)

registerCommand({
  id: 'incidents.incidents.resolve',
  async execute(rawInput, ctx) {
    const parsed = resolveIncidentSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const now = new Date()
    const report = await de.updateOrmEntity({ entity: IncidentReport,
      where: { id: parsed.id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<IncidentReport>,
      apply: (e) => {
        e.status = parsed.status as IncidentStatus
        e.resolutionDescription = parsed.resolution_description
        e.resolvedBy = ctx.auth?.userId ?? ctx.auth?.sub ?? null
        e.resolvedAt = now
      },
    })
    if (!report) throw new CrudHttpError(404, { error: 'Incident not found' })

    // Emit resolved event
    try {
      const eventBus = ctx.container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
      await eventBus.emit('incidents.report.resolved', {
        incidentId: report.id, competitionId: report.competitionId,
        status: report.status, resolvedBy: report.resolvedBy,
        tenantId: scope.tenantId, organizationId: scope.organizationId,
      })
    } catch (e) { console.error('[incidents:resolve] Event emit error:', e) }

    return report
  },
} as CommandHandler<Record<string, unknown>, IncidentReport>)
