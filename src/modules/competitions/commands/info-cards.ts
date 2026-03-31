import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { FilterQuery } from '@mikro-orm/postgresql'
import { CompetitionInfoCard } from '../data/entities'
import { createCompetitionInfoCardSchema, updateCompetitionInfoCardSchema } from '../data/validators'

const ENTITY_ID = 'competitions:competition_info_card'

function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}

export const competitionInfoCardCrudEvents: CrudEventsConfig<CompetitionInfoCard> = {
  module: 'competitions',
  entity: 'competition_info_card',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<CompetitionInfoCard>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

export const competitionInfoCardCrudIndexer: CrudIndexerConfig<CompetitionInfoCard> = {
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<CompetitionInfoCard>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<CompetitionInfoCard>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

registerCommand({
  id: 'competitions.info_cards.create',
  async execute(rawInput, ctx) {
    const parsed = createCompetitionInfoCardSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const infoCard = await de.createOrmEntity({
      entity: CompetitionInfoCard,
      data: {
        competitionId: parsed.competition_id,
        key: parsed.key,
        icon: parsed.icon ?? null,
        label: parsed.label,
        value: parsed.value,
        sortOrder: parsed.sort_order,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: infoCard,
      identifiers: {
        id: String(infoCard.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: competitionInfoCardCrudEvents,
      indexer: competitionInfoCardCrudIndexer,
    })

    return infoCard
  },
} as CommandHandler<Record<string, unknown>, CompetitionInfoCard>)

registerCommand({
  id: 'competitions.info_cards.update',
  async execute(rawInput, ctx) {
    const parsed = updateCompetitionInfoCardSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const infoCard = await de.updateOrmEntity({
      entity: CompetitionInfoCard,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<CompetitionInfoCard>,
      apply: (entity) => {
        if (parsed.competition_id !== undefined) entity.competitionId = parsed.competition_id
        if (parsed.key !== undefined) entity.key = parsed.key
        if (parsed.icon !== undefined) entity.icon = parsed.icon
        if (parsed.label !== undefined) entity.label = parsed.label
        if (parsed.value !== undefined) entity.value = parsed.value
        if (parsed.sort_order !== undefined) entity.sortOrder = parsed.sort_order
      },
    })
    if (!infoCard) throw new CrudHttpError(404, { error: 'Info card not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: infoCard,
      identifiers: {
        id: String(infoCard.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: competitionInfoCardCrudEvents,
      indexer: competitionInfoCardCrudIndexer,
    })

    return infoCard
  },
} as CommandHandler<Record<string, unknown>, CompetitionInfoCard>)

registerCommand({
  id: 'competitions.info_cards.delete',
  async execute(input, ctx) {
    const id = requireId(input, 'Info card id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const infoCard = await de.deleteOrmEntity({
      entity: CompetitionInfoCard,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<CompetitionInfoCard>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    if (!infoCard) throw new CrudHttpError(404, { error: 'Info card not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: infoCard,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: competitionInfoCardCrudEvents,
      indexer: competitionInfoCardCrudIndexer,
    })

    return infoCard
  },
} as CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, CompetitionInfoCard>)
