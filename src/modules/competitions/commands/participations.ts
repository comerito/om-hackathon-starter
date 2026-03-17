import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import {
  emitCrudSideEffects,
  requireId,
} from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { CompetitionParticipation, ParticipationRole } from '../data/entities'
import { createParticipationSchema, updateParticipationSchema } from '../data/validators'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'

export const participationCreateSchema = createParticipationSchema
export const participationUpdateSchema = updateParticipationSchema

const ENTITY_TYPE = 'competitions:participation' as const

type SerializedParticipation = {
  id: string
  competitionId: string
  customerUserId: string
  role: string
  tenantId: string | null
  organizationId: string | null
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
  entityType: ENTITY_TYPE,
  buildUpsertPayload: (ctx: CrudEmitContext<CompetitionParticipation>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<CompetitionParticipation>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const createParticipationCommand: CommandHandler<Record<string, unknown>, CompetitionParticipation> = {
  id: 'competitions.participation.create',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = participationCreateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const participation = await de.createOrmEntity({
      entity: CompetitionParticipation,
      data: {
        competitionId: parsed.competitionId,
        customerUserId: parsed.customerUserId,
        role: (parsed.role ?? ParticipationRole.PARTICIPANT) as ParticipationRole,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: participation,
      identifiers: {
        id: String(participation.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: participationCrudEvents,
      indexer: participationCrudIndexer,
    })

    return participation
  },
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('competitions.audit.participation.create', 'Register participant'),
      resourceKind: 'competitions.participation',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      snapshotAfter: serializeParticipation(result),
    }
  },
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

const updateParticipationCommand: CommandHandler<Record<string, unknown>, CompetitionParticipation> = {
  id: 'competitions.participation.update',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = participationUpdateSchema.parse(rawInput)
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
        if (parsed.cocAccepted !== undefined) {
          entity.cocAccepted = parsed.cocAccepted
          if (parsed.cocAccepted && !entity.cocAcceptedAt) {
            entity.cocAcceptedAt = new Date()
          }
        }
        if (parsed.privacyPolicyAccepted !== undefined) {
          entity.privacyPolicyAccepted = parsed.privacyPolicyAccepted
          if (parsed.privacyPolicyAccepted && !entity.privacyPolicyAcceptedAt) {
            entity.privacyPolicyAcceptedAt = new Date()
          }
        }
        if (parsed.lookingForTeam !== undefined) entity.lookingForTeam = parsed.lookingForTeam
        if (parsed.lookingForTeamDescription !== undefined) entity.lookingForTeamDescription = parsed.lookingForTeamDescription
        if (parsed.profileComplete !== undefined) entity.profileComplete = parsed.profileComplete
      },
    })
    if (!participation) throw new CrudHttpError(404, { error: 'Participation not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: participation,
      identifiers: {
        id: String(participation.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: participationCrudEvents,
      indexer: participationCrudIndexer,
    })

    return participation
  },
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('competitions.audit.participation.update', 'Update participation'),
      resourceKind: 'competitions.participation',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
    }
  },
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

const deleteParticipationCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, CompetitionParticipation> = {
  id: 'competitions.participation.delete',
  isUndoable: false,
  async execute(input, ctx) {
    const id = requireId(input, 'Participation id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

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
      identifiers: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: participationCrudEvents,
      indexer: participationCrudIndexer,
    })

    return participation
  },
  buildLog: async ({ input }) => {
    const { translate } = await resolveTranslations()
    const id = requireId(input, 'Participation id required')
    return {
      actionLabel: translate('competitions.audit.participation.delete', 'Delete participation'),
      resourceKind: 'competitions.participation',
      resourceId: id,
      tenantId: null,
      organizationId: null,
    }
  },
}

// ---------------------------------------------------------------------------
// Register commands
// ---------------------------------------------------------------------------

registerCommand(createParticipationCommand)
registerCommand(updateParticipationCommand)
registerCommand(deleteParticipationCommand)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeParticipation(p: CompetitionParticipation): SerializedParticipation {
  return {
    id: String(p.id),
    competitionId: String(p.competitionId),
    customerUserId: String(p.customerUserId),
    role: String(p.role),
    tenantId: p.tenantId ? String(p.tenantId) : null,
    organizationId: p.organizationId ? String(p.organizationId) : null,
  }
}

function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}
