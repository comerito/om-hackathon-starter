import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { FilterQuery } from '@mikro-orm/postgresql'
import { Prize } from '../data/entities'
import { createPrizeSchema, updatePrizeSchema } from '../data/validators'

const ENTITY_ID = 'sponsors:prize'

export const prizeCrudEvents: CrudEventsConfig<Prize> = {
  module: 'sponsors', entity: 'prize', persistent: true,
  buildPayload: (ctx: CrudEmitContext<Prize>) => ({
    id: ctx.identifiers.id, tenantId: ctx.identifiers.tenantId, organizationId: ctx.identifiers.organizationId,
  }),
}

export const prizeCrudIndexer: CrudIndexerConfig<Prize> = {
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<Prize>) => ({ entityType: ENTITY_ID, recordId: ctx.identifiers.id, tenantId: ctx.identifiers.tenantId, organizationId: ctx.identifiers.organizationId }),
  buildDeletePayload: (ctx: CrudEmitContext<Prize>) => ({ entityType: ENTITY_ID, recordId: ctx.identifiers.id, tenantId: ctx.identifiers.tenantId, organizationId: ctx.identifiers.organizationId }),
}

function ensureScope(ctx: CommandRuntimeContext) {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}

registerCommand({
  id: 'sponsors.prizes.create',
  async execute(rawInput, ctx) {
    const parsed = createPrizeSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const prize = await de.createOrmEntity({ entity: Prize, data: {
      competitionId: parsed.competition_id, name: parsed.name, description: parsed.description ?? null,
      category: parsed.category, trackId: parsed.track_id ?? null, sponsorId: parsed.sponsor_id ?? null,
      value: parsed.value ?? null, rank: parsed.rank ?? null, iconUrl: parsed.icon_url ?? null,
      order: parsed.order, tenantId: scope.tenantId, organizationId: scope.organizationId,
    }})
    await emitCrudSideEffects({ dataEngine: de, action: 'created', entity: prize,
      identifiers: { id: String(prize.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: prizeCrudEvents, indexer: prizeCrudIndexer })
    return prize
  },
} as CommandHandler<Record<string, unknown>, Prize>)

registerCommand({
  id: 'sponsors.prizes.update',
  async execute(rawInput, ctx) {
    const parsed = updatePrizeSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const prize = await de.updateOrmEntity({ entity: Prize,
      where: { id: parsed.id, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null } as FilterQuery<Prize>,
      apply: (e) => {
        if (parsed.name !== undefined) e.name = parsed.name
        if (parsed.description !== undefined) e.description = parsed.description
        if (parsed.category !== undefined) e.category = parsed.category
        if (parsed.track_id !== undefined) e.trackId = parsed.track_id
        if (parsed.sponsor_id !== undefined) e.sponsorId = parsed.sponsor_id
        if (parsed.value !== undefined) e.value = parsed.value
        if (parsed.rank !== undefined) e.rank = parsed.rank
        if (parsed.icon_url !== undefined) e.iconUrl = parsed.icon_url
        if (parsed.order !== undefined) e.order = parsed.order
      },
    })
    if (!prize) throw new CrudHttpError(404, { error: 'Prize not found' })
    await emitCrudSideEffects({ dataEngine: de, action: 'updated', entity: prize,
      identifiers: { id: String(prize.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: prizeCrudEvents, indexer: prizeCrudIndexer })
    return prize
  },
} as CommandHandler<Record<string, unknown>, Prize>)

registerCommand({
  id: 'sponsors.prizes.delete',
  async execute(input, ctx) {
    const id = requireId(input, 'Prize id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const prize = await de.deleteOrmEntity({ entity: Prize,
      where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null } as FilterQuery<Prize>,
      soft: true, softDeleteField: 'deletedAt' })
    if (!prize) throw new CrudHttpError(404, { error: 'Prize not found' })
    await emitCrudSideEffects({ dataEngine: de, action: 'deleted', entity: prize,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: prizeCrudEvents, indexer: prizeCrudIndexer })
    return prize
  },
} as CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, Prize>)
