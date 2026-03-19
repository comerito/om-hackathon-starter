import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { FilterQuery } from '@mikro-orm/postgresql'
import { CompetitionParticipation } from '../data/entities'
import { createParticipationSchema, updateParticipationSchema } from '../data/validators'

const ENTITY_ID = 'competitions:participation'

function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}

export const participationCrudEvents: CrudEventsConfig<CompetitionParticipation> = {
  module: 'competitions',
  entity: 'participation',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<CompetitionParticipation>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

export const participationCrudIndexer: CrudIndexerConfig<CompetitionParticipation> = {
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<CompetitionParticipation>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<CompetitionParticipation>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

const createParticipationCommand: CommandHandler<Record<string, unknown>, CompetitionParticipation> = {
  id: 'competitions.participations.create',
  async execute(rawInput, ctx) {
    const parsed = createParticipationSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const participation = await de.createOrmEntity({
      entity: CompetitionParticipation,
      data: {
        competitionId: parsed.competition_id,
        customerUserId: parsed.customer_user_id,
        role: parsed.role,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: participation,
      identifiers: { id: String(participation.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: participationCrudEvents,
      indexer: participationCrudIndexer,
    })

    return participation
  },
}

const updateParticipationCommand: CommandHandler<Record<string, unknown>, CompetitionParticipation> = {
  id: 'competitions.participations.update',
  async execute(rawInput, ctx) {
    const parsed = updateParticipationSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const participation = await de.updateOrmEntity({
      entity: CompetitionParticipation,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<CompetitionParticipation>,
      apply: (entity) => {
        if (parsed.role !== undefined) entity.role = parsed.role
        if (parsed.checked_in !== undefined) {
          entity.checkedIn = parsed.checked_in
          if (parsed.checked_in) entity.checkedInAt = new Date()
        }
        if (parsed.coc_accepted !== undefined) {
          entity.cocAccepted = parsed.coc_accepted
          if (parsed.coc_accepted) entity.cocAcceptedAt = new Date()
        }
        if (parsed.privacy_policy_accepted !== undefined) {
          entity.privacyPolicyAccepted = parsed.privacy_policy_accepted
          if (parsed.privacy_policy_accepted) entity.privacyPolicyAcceptedAt = new Date()
        }
        if (parsed.looking_for_team !== undefined) entity.lookingForTeam = parsed.looking_for_team
        if (parsed.looking_for_team_description !== undefined) entity.lookingForTeamDescription = parsed.looking_for_team_description
        if (parsed.profile_complete !== undefined) entity.profileComplete = parsed.profile_complete
      },
    })
    if (!participation) throw new CrudHttpError(404, { error: 'Participation not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: participation,
      identifiers: { id: String(participation.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: participationCrudEvents,
      indexer: participationCrudIndexer,
    })

    return participation
  },
}

const deleteParticipationCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, CompetitionParticipation> = {
  id: 'competitions.participations.delete',
  async execute(input, ctx) {
    const id = requireId(input, 'Participation id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as import('@mikro-orm/postgresql').EntityManager

    const participation = await em.findOne(CompetitionParticipation, {
      id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<CompetitionParticipation>)
    if (!participation) throw new CrudHttpError(404, { error: 'Participation not found' })

    await em.removeAndFlush(participation)

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: participation,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: participationCrudEvents,
      indexer: participationCrudIndexer,
    })

    return participation
  },
}

registerCommand(createParticipationCommand)
registerCommand(updateParticipationCommand)
registerCommand(deleteParticipationCommand)
