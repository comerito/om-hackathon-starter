import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { FilterQuery } from '@mikro-orm/postgresql'
import { JudgePanel } from '../data/entities'
import { createPanelSchema, updatePanelSchema } from '../data/validators'

const ENTITY_ID = 'judging:judge_panel'

export const panelCrudEvents: CrudEventsConfig<JudgePanel> = {
  module: 'judging',
  entity: 'panel',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<JudgePanel>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

export const panelCrudIndexer: CrudIndexerConfig<JudgePanel> = {
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<JudgePanel>) => ({
    entityType: ENTITY_ID, recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId, organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<JudgePanel>) => ({
    entityType: ENTITY_ID, recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId, organizationId: ctx.identifiers.organizationId,
  }),
}

function ensureScope(ctx: CommandRuntimeContext) {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}

const createPanelCommand: CommandHandler<Record<string, unknown>, JudgePanel> = {
  id: 'judging.panels.create',
  async execute(rawInput, ctx) {
    const parsed = createPanelSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const panel = await de.createOrmEntity({
      entity: JudgePanel,
      data: {
        competitionId: parsed.competition_id,
        name: parsed.name,
        round: parsed.round,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })
    await emitCrudSideEffects({
      dataEngine: de, action: 'created', entity: panel,
      identifiers: { id: String(panel.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: panelCrudEvents, indexer: panelCrudIndexer,
    })
    return panel
  },
}

const updatePanelCommand: CommandHandler<Record<string, unknown>, JudgePanel> = {
  id: 'judging.panels.update',
  async execute(rawInput, ctx) {
    const parsed = updatePanelSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const panel = await de.updateOrmEntity({
      entity: JudgePanel,
      where: { id: parsed.id, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null } as FilterQuery<JudgePanel>,
      apply: (e) => {
        if (parsed.name !== undefined) e.name = parsed.name
        if (parsed.round !== undefined) e.round = parsed.round
      },
    })
    if (!panel) throw new CrudHttpError(404, { error: 'Panel not found' })
    await emitCrudSideEffects({
      dataEngine: de, action: 'updated', entity: panel,
      identifiers: { id: String(panel.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: panelCrudEvents, indexer: panelCrudIndexer,
    })
    return panel
  },
}

const deletePanelCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, JudgePanel> = {
  id: 'judging.panels.delete',
  async execute(input, ctx) {
    const id = requireId(input, 'Panel id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const panel = await de.deleteOrmEntity({
      entity: JudgePanel,
      where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null } as FilterQuery<JudgePanel>,
      soft: true, softDeleteField: 'deletedAt',
    })
    if (!panel) throw new CrudHttpError(404, { error: 'Panel not found' })
    await emitCrudSideEffects({
      dataEngine: de, action: 'deleted', entity: panel,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: panelCrudEvents, indexer: panelCrudIndexer,
    })
    return panel
  },
}

registerCommand(createPanelCommand)
registerCommand(updatePanelCommand)
registerCommand(deletePanelCommand)
