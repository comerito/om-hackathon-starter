import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import {
  emitCrudSideEffects,
  emitCrudUndoSideEffects,
  buildChanges,
  requireId,
} from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { IncidentReport, IncidentStatus } from '../data/entities'
import {
  createIncidentSchema,
  updateIncidentSchema,
  resolveIncidentSchema,
} from '../data/validators'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ENTITY_TYPE = 'incidents:report' as const

export const incidentCrudEvents: CrudEventsConfig<IncidentReport> = {
  module: 'incidents',
  entity: 'report',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<IncidentReport>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

export const incidentCrudIndexer: CrudIndexerConfig<IncidentReport> = {
  entityType: ENTITY_TYPE,
  buildUpsertPayload: (ctx: CrudEmitContext<IncidentReport>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<IncidentReport>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

type SerializedIncident = {
  id: string
  competitionId: string
  reporterId: string | null
  reportedUserId: string | null
  description: string
  severity: string
  status: string
  adminNotes: string | null
  resolvedBy: string | null
  resolutionDescription: string | null
  resolvedAt: string | null
  tenantId: string | null
  organizationId: string | null
}

function serializeIncident(r: IncidentReport): SerializedIncident {
  return {
    id: String(r.id),
    competitionId: String(r.competitionId),
    reporterId: r.reporterId ? String(r.reporterId) : null,
    reportedUserId: r.reportedUserId ? String(r.reportedUserId) : null,
    description: String(r.description),
    severity: String(r.severity),
    status: String(r.status),
    adminNotes: r.adminNotes ? String(r.adminNotes) : null,
    resolvedBy: r.resolvedBy ? String(r.resolvedBy) : null,
    resolutionDescription: r.resolutionDescription ? String(r.resolutionDescription) : null,
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    tenantId: r.tenantId ? String(r.tenantId) : null,
    organizationId: r.organizationId ? String(r.organizationId) : null,
  }
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const createIncidentCommand: CommandHandler<Record<string, unknown>, IncidentReport> = {
  id: 'incidents.report.create',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = createIncidentSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    // If anonymous, do not store reporter id
    const reporterId = parsed.anonymous ? null : (ctx.auth?.customerUserId ?? ctx.auth?.userId ?? null)

    const report = await de.createOrmEntity({
      entity: IncidentReport,
      data: {
        competitionId: parsed.competitionId,
        reporterId,
        reportedUserId: parsed.reportedUserId ?? null,
        description: parsed.description,
        severity: parsed.severity as IncidentReport['severity'],
        status: IncidentStatus.REPORTED,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: report,
      identifiers: {
        id: String(report.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: incidentCrudEvents,
      indexer: incidentCrudIndexer,
    })

    return report
  },
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('incidents.audit.report.create', 'Report incident'),
      resourceKind: 'incidents.report',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      snapshotAfter: serializeIncident(result),
    }
  },
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

const updateIncidentCommand: CommandHandler<Record<string, unknown>, IncidentReport> = {
  id: 'incidents.report.update',
  isUndoable: true,
  async prepare(rawInput, ctx) {
    const parsed = updateIncidentSchema.parse(rawInput)
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(IncidentReport, { id: parsed.id } as FilterQuery<IncidentReport>)
    if (!existing) throw new CrudHttpError(404, { error: 'Incident not found' })
    return { before: serializeIncident(existing) }
  },
  async execute(rawInput, ctx) {
    const parsed = updateIncidentSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const report = await de.updateOrmEntity({
      entity: IncidentReport,
      where: { id: parsed.id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<IncidentReport>,
      apply: (entity) => {
        if (parsed.description !== undefined) entity.description = parsed.description
        if (parsed.severity !== undefined) entity.severity = parsed.severity as IncidentReport['severity']
        if (parsed.status !== undefined) entity.status = parsed.status as IncidentReport['status']
        if (parsed.adminNotes !== undefined) entity.adminNotes = parsed.adminNotes
        if (parsed.reportedUserId !== undefined) entity.reportedUserId = parsed.reportedUserId
      },
    })
    if (!report) throw new CrudHttpError(404, { error: 'Incident not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: report,
      identifiers: { id: String(report.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: incidentCrudEvents,
      indexer: incidentCrudIndexer,
    })

    return report
  },
  captureAfter: (_input, result) => serializeIncident(result),
  buildLog: async ({ result, snapshots }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as SerializedIncident | undefined
    const after = serializeIncident(result)
    const changes = buildChanges(
      before ?? null,
      after as unknown as Record<string, unknown>,
      ['description', 'severity', 'status', 'adminNotes', 'reportedUserId'],
    )
    return {
      actionLabel: translate('incidents.audit.report.update', 'Update incident'),
      resourceKind: 'incidents.report',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      changes,
      snapshotBefore: before ?? null,
      snapshotAfter: after,
    }
  },
  async undo({ logEntry, ctx }) {
    const before = logEntry.snapshotBefore as SerializedIncident | undefined
    if (!before?.id) throw new Error('Missing previous snapshot for undo')
    const scope = resolveUndoScope(ctx, before)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    await de.updateOrmEntity({
      entity: IncidentReport,
      where: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<IncidentReport>,
      apply: (entity) => {
        entity.description = before.description
        entity.severity = before.severity as IncidentReport['severity']
        entity.status = before.status as IncidentReport['status']
        entity.adminNotes = before.adminNotes
        entity.reportedUserId = before.reportedUserId
      },
    })

    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: null as unknown as IncidentReport,
      identifiers: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: incidentCrudEvents,
      indexer: incidentCrudIndexer,
    })
  },
}

// ---------------------------------------------------------------------------
// Resolve
// ---------------------------------------------------------------------------

const resolveIncidentCommand: CommandHandler<Record<string, unknown>, IncidentReport> = {
  id: 'incidents.report.resolve',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = resolveIncidentSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const userId = ctx.auth?.userId ?? null

    const report = await de.updateOrmEntity({
      entity: IncidentReport,
      where: { id: parsed.id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<IncidentReport>,
      apply: (entity) => {
        entity.status = parsed.status as IncidentReport['status']
        entity.resolutionDescription = parsed.resolutionDescription
        entity.resolvedBy = userId
        entity.resolvedAt = new Date()
      },
    })
    if (!report) throw new CrudHttpError(404, { error: 'Incident not found' })

    // Emit resolved event specifically
    try {
      const eventBus = de as unknown as {
        emitEvent?: (event: string, payload: unknown) => Promise<void>
      }
      if (typeof eventBus.emitEvent === 'function') {
        await eventBus.emitEvent('incidents.report.resolved', {
          id: String(report.id),
          tenantId: scope.tenantId,
          organizationId: scope.organizationId,
          status: report.status,
        })
      }
    } catch {
      // non-critical: also emit via CRUD side effects
    }

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: report,
      identifiers: { id: String(report.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: {
        ...incidentCrudEvents,
        // Override to emit resolved event
        buildPayload: (emitCtx: CrudEmitContext<IncidentReport>) => ({
          id: emitCtx.identifiers.id,
          tenantId: emitCtx.identifiers.tenantId,
          organizationId: emitCtx.identifiers.organizationId,
          status: report.status,
          resolvedBy: userId,
        }),
      },
      indexer: incidentCrudIndexer,
    })

    return report
  },
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('incidents.audit.report.resolve', 'Resolve incident'),
      resourceKind: 'incidents.report',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      snapshotAfter: serializeIncident(result),
    }
  },
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

const deleteIncidentCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, IncidentReport> = {
  id: 'incidents.report.delete',
  isUndoable: false,
  async execute(input, ctx) {
    const id = requireId(input, 'Incident id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const report = await de.deleteOrmEntity({
      entity: IncidentReport,
      where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<IncidentReport>,
      soft: false,
    })
    if (!report) throw new CrudHttpError(404, { error: 'Incident not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: report,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: incidentCrudEvents,
      indexer: incidentCrudIndexer,
    })

    return report
  },
  buildLog: async ({ input }) => {
    const { translate } = await resolveTranslations()
    const id = requireId(input, 'Incident id required')
    return {
      actionLabel: translate('incidents.audit.report.delete', 'Delete incident'),
      resourceKind: 'incidents.report',
      resourceId: id,
      tenantId: null,
      organizationId: null,
    }
  },
}

// ---------------------------------------------------------------------------
// Register commands
// ---------------------------------------------------------------------------

registerCommand(createIncidentCommand)
registerCommand(updateIncidentCommand)
registerCommand(resolveIncidentCommand)
registerCommand(deleteIncidentCommand)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveUndoScope(
  ctx: CommandRuntimeContext,
  snapshot?: { tenantId: string | null; organizationId: string | null },
): { tenantId: string; organizationId: string } {
  const scope = ensureScope(ctx)
  const tenantId = snapshot?.tenantId ?? scope.tenantId
  if (tenantId !== scope.tenantId) {
    throw new CrudHttpError(403, { error: 'Undo scope does not match tenant' })
  }
  let organizationId = scope.organizationId
  if (snapshot?.organizationId) {
    const allowed = Array.isArray(ctx.organizationIds) ? ctx.organizationIds : null
    if (allowed && allowed.length > 0 && !allowed.includes(snapshot.organizationId)) {
      throw new CrudHttpError(403, { error: 'Undo scope is not permitted for this organization' })
    }
    organizationId = snapshot.organizationId
  }
  return { tenantId, organizationId }
}

function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}
