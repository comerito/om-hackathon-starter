import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { FilterQuery } from '@mikro-orm/postgresql'
import { JudgingCriterion } from '../data/entities'
import { createCriterionSchema, updateCriterionSchema } from '../data/validators'

const ENTITY_ID = 'judging:judging_criterion'

export const criterionCrudEvents: CrudEventsConfig<JudgingCriterion> = {
  module: 'judging', entity: 'criterion', persistent: true,
  buildPayload: (ctx: CrudEmitContext<JudgingCriterion>) => ({
    id: ctx.identifiers.id, tenantId: ctx.identifiers.tenantId, organizationId: ctx.identifiers.organizationId,
  }),
}

export const criterionCrudIndexer: CrudIndexerConfig<JudgingCriterion> = {
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<JudgingCriterion>) => ({
    entityType: ENTITY_ID, recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId, organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<JudgingCriterion>) => ({
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

const createCriterionCommand: CommandHandler<Record<string, unknown>, JudgingCriterion> = {
  id: 'judging.criteria.create',
  async execute(rawInput, ctx) {
    const parsed = createCriterionSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const criterion = await de.createOrmEntity({
      entity: JudgingCriterion,
      data: {
        competitionId: parsed.competition_id,
        trackId: parsed.track_id ?? null,
        round: parsed.round,
        name: parsed.name,
        description: parsed.description ?? null,
        maxScore: parsed.max_score,
        weight: parsed.weight,
        order: parsed.order,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })
    await emitCrudSideEffects({
      dataEngine: de, action: 'created', entity: criterion,
      identifiers: { id: String(criterion.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: criterionCrudEvents, indexer: criterionCrudIndexer,
    })
    return criterion
  },
}

const updateCriterionCommand: CommandHandler<Record<string, unknown>, JudgingCriterion> = {
  id: 'judging.criteria.update',
  async execute(rawInput, ctx) {
    const parsed = updateCriterionSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const criterion = await de.updateOrmEntity({
      entity: JudgingCriterion,
      where: { id: parsed.id, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null } as FilterQuery<JudgingCriterion>,
      apply: (e) => {
        if (parsed.track_id !== undefined) e.trackId = parsed.track_id
        if (parsed.name !== undefined) e.name = parsed.name
        if (parsed.description !== undefined) e.description = parsed.description
        if (parsed.max_score !== undefined) e.maxScore = parsed.max_score
        if (parsed.weight !== undefined) e.weight = parsed.weight
        if (parsed.round !== undefined) e.round = parsed.round
        if (parsed.order !== undefined) e.order = parsed.order
      },
    })
    if (!criterion) throw new CrudHttpError(404, { error: 'Criterion not found' })
    await emitCrudSideEffects({
      dataEngine: de, action: 'updated', entity: criterion,
      identifiers: { id: String(criterion.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: criterionCrudEvents, indexer: criterionCrudIndexer,
    })
    return criterion
  },
}

const deleteCriterionCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, JudgingCriterion> = {
  id: 'judging.criteria.delete',
  async execute(input, ctx) {
    const id = requireId(input, 'Criterion id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const criterion = await de.deleteOrmEntity({
      entity: JudgingCriterion,
      where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null } as FilterQuery<JudgingCriterion>,
      soft: true, softDeleteField: 'deletedAt',
    })
    if (!criterion) throw new CrudHttpError(404, { error: 'Criterion not found' })
    await emitCrudSideEffects({
      dataEngine: de, action: 'deleted', entity: criterion,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: criterionCrudEvents, indexer: criterionCrudIndexer,
    })
    return criterion
  },
}

registerCommand(createCriterionCommand)
registerCommand(updateCriterionCommand)
registerCommand(deleteCriterionCommand)
