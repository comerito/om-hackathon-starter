import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import type { FilterQuery } from '@mikro-orm/postgresql'
import { TeamMember } from '../data/entities'
import { createTeamMemberSchema } from '../data/validators'

const ENTITY_ID = 'teams:team_member'

export const memberCrudEvents: CrudEventsConfig<TeamMember> = {
  module: 'teams',
  entity: 'member',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<TeamMember>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

export const memberCrudIndexer: CrudIndexerConfig<TeamMember> = {
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<TeamMember>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<TeamMember>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}

const createMemberCommand: CommandHandler<Record<string, unknown>, TeamMember> = {
  id: 'teams.members.create',
  async execute(rawInput, ctx) {
    const parsed = createTeamMemberSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const member = await de.createOrmEntity({
      entity: TeamMember,
      data: {
        teamId: parsed.team_id,
        customerUserId: parsed.customer_user_id,
        competitionId: parsed.competition_id,
        role: parsed.role,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: member,
      identifiers: { id: String(member.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: memberCrudEvents,
      indexer: memberCrudIndexer,
    })

    return member
  },
}

const deleteMemberCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, TeamMember> = {
  id: 'teams.members.delete',
  async execute(input, ctx) {
    const id = requireId(input, 'Member id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const member = await de.deleteOrmEntity({
      entity: TeamMember,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<TeamMember>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    if (!member) throw new CrudHttpError(404, { error: 'Team member not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: member,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: memberCrudEvents,
      indexer: memberCrudIndexer,
    })

    return member
  },
}

registerCommand(createMemberCommand)
registerCommand(deleteMemberCommand)
