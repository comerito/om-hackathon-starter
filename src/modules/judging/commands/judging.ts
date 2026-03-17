import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import {
  emitCrudSideEffects,
  requireId,
} from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { JudgePanel, JudgingCriterion } from '../data/entities'
import { createPanelSchema, updatePanelSchema, createCriterionSchema, updateCriterionSchema } from '../data/validators'

// ---------------------------------------------------------------------------
// Event config
// ---------------------------------------------------------------------------

const panelCrudEvents: CrudEventsConfig<JudgePanel> = {
  module: 'judging',
  entity: 'panel',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

const criterionCrudEvents: CrudEventsConfig<JudgingCriterion> = {
  module: 'judging',
  entity: 'criterion',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}

// ---------------------------------------------------------------------------
// Panel — Create
// ---------------------------------------------------------------------------

const createPanelCommand: CommandHandler<Record<string, unknown>, JudgePanel> = {
  id: 'judging.panel.create',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = createPanelSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const panel = await de.createOrmEntity({
      entity: JudgePanel,
      data: {
        competitionId: parsed.competitionId,
        name: parsed.name,
        round: parsed.round,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: panel,
      identifiers: {
        id: String(panel.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: panelCrudEvents,
    })

    return panel
  },
}

// ---------------------------------------------------------------------------
// Panel — Update
// ---------------------------------------------------------------------------

const updatePanelCommand: CommandHandler<Record<string, unknown>, JudgePanel> = {
  id: 'judging.panel.update',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = updatePanelSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const panel = await de.updateOrmEntity({
      entity: JudgePanel,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<JudgePanel>,
      apply: (entity) => {
        if (parsed.name !== undefined) entity.name = parsed.name
        if (parsed.round !== undefined) entity.round = parsed.round as JudgePanel['round']
      },
    })
    if (!panel) throw new CrudHttpError(404, { error: 'Panel not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: panel,
      identifiers: {
        id: String(panel.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: panelCrudEvents,
    })

    return panel
  },
}

// ---------------------------------------------------------------------------
// Panel — Delete
// ---------------------------------------------------------------------------

const deletePanelCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, JudgePanel> = {
  id: 'judging.panel.delete',
  isUndoable: false,
  async execute(input, ctx) {
    const id = requireId(input, 'Panel id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const panel = await de.deleteOrmEntity({
      entity: JudgePanel,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<JudgePanel>,
      soft: true,
    })
    if (!panel) throw new CrudHttpError(404, { error: 'Panel not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: panel,
      identifiers: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: panelCrudEvents,
    })

    return panel
  },
}

// ---------------------------------------------------------------------------
// Criterion — Create
// ---------------------------------------------------------------------------

const createCriterionCommand: CommandHandler<Record<string, unknown>, JudgingCriterion> = {
  id: 'judging.criterion.create',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = createCriterionSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const criterion = await de.createOrmEntity({
      entity: JudgingCriterion,
      data: {
        competitionId: parsed.competitionId,
        trackId: parsed.trackId ?? null,
        round: parsed.round,
        name: parsed.name,
        description: parsed.description ?? null,
        maxScore: parsed.maxScore,
        weight: parsed.weight,
        order: parsed.order,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: criterion,
      identifiers: {
        id: String(criterion.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: criterionCrudEvents,
    })

    return criterion
  },
}

// ---------------------------------------------------------------------------
// Criterion — Update
// ---------------------------------------------------------------------------

const updateCriterionCommand: CommandHandler<Record<string, unknown>, JudgingCriterion> = {
  id: 'judging.criterion.update',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = updateCriterionSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const criterion = await de.updateOrmEntity({
      entity: JudgingCriterion,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<JudgingCriterion>,
      apply: (entity) => {
        if (parsed.name !== undefined) entity.name = parsed.name
        if (parsed.description !== undefined) entity.description = parsed.description
        if (parsed.maxScore !== undefined) entity.maxScore = parsed.maxScore
        if (parsed.weight !== undefined) entity.weight = parsed.weight
        if (parsed.order !== undefined) entity.order = parsed.order
        if (parsed.round !== undefined) entity.round = parsed.round as JudgingCriterion['round']
        if (parsed.trackId !== undefined) entity.trackId = parsed.trackId
      },
    })
    if (!criterion) throw new CrudHttpError(404, { error: 'Criterion not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: criterion,
      identifiers: {
        id: String(criterion.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: criterionCrudEvents,
    })

    return criterion
  },
}

// ---------------------------------------------------------------------------
// Criterion — Delete
// ---------------------------------------------------------------------------

const deleteCriterionCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, JudgingCriterion> = {
  id: 'judging.criterion.delete',
  isUndoable: false,
  async execute(input, ctx) {
    const id = requireId(input, 'Criterion id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const criterion = await de.deleteOrmEntity({
      entity: JudgingCriterion,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<JudgingCriterion>,
      soft: true,
    })
    if (!criterion) throw new CrudHttpError(404, { error: 'Criterion not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: criterion,
      identifiers: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: criterionCrudEvents,
    })

    return criterion
  },
}

// ---------------------------------------------------------------------------
// Register commands
// ---------------------------------------------------------------------------

registerCommand(createPanelCommand)
registerCommand(updatePanelCommand)
registerCommand(deletePanelCommand)
registerCommand(createCriterionCommand)
registerCommand(updateCriterionCommand)
registerCommand(deleteCriterionCommand)

export {
  panelCrudEvents,
  criterionCrudEvents,
}
