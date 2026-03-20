import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { TeamInvitation, InvitationStatus } from '../data/entities'
import { createTeamInvitationSchema, updateTeamInvitationSchema } from '../data/validators'

const ENTITY_ID = 'teams:invitation'

export const invitationCrudEvents: CrudEventsConfig<TeamInvitation> = {
  module: 'teams',
  entity: 'invitation',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<TeamInvitation>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

export const invitationCrudIndexer: CrudIndexerConfig<TeamInvitation> = {
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<TeamInvitation>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<TeamInvitation>) => ({
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

const createInvitationCommand: CommandHandler<Record<string, unknown>, TeamInvitation> = {
  id: 'teams.invitations.create',
  async execute(rawInput, ctx) {
    const parsed = createTeamInvitationSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const invitation = await de.createOrmEntity({
      entity: TeamInvitation,
      data: {
        teamId: parsed.team_id,
        inviterId: ctx.auth?.userId ?? ctx.auth?.sub ?? scope.tenantId,
        inviteeId: parsed.invitee_id,
        type: parsed.type,
        message: parsed.message ?? null,
        expiresAt: new Date(parsed.expires_at),
        competitionId: parsed.competition_id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: invitation,
      identifiers: { id: String(invitation.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: invitationCrudEvents,
      indexer: invitationCrudIndexer,
    })

    return invitation
  },
}

const updateInvitationCommand: CommandHandler<Record<string, unknown>, TeamInvitation> = {
  id: 'teams.invitations.update',
  async execute(rawInput, ctx) {
    const parsed = updateTeamInvitationSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const em = ctx.container.resolve('em') as EntityManager
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const invitation = await em.findOne(TeamInvitation, {
      id: parsed.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<TeamInvitation>)
    if (!invitation) throw new CrudHttpError(404, { error: 'Invitation not found' })

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new CrudHttpError(400, { error: `Cannot change invitation that is already ${invitation.status}` })
    }

    invitation.status = parsed.status as typeof invitation.status
    invitation.respondedAt = new Date()
    await em.persistAndFlush(invitation)

    // Emit specific event based on status change
    const eventBus = ctx.container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
    if (parsed.status === 'accepted') {
      await eventBus.emit('teams.invitation.accepted', {
        invitationId: invitation.id,
        teamId: invitation.teamId,
        inviteeId: invitation.inviteeId,
        competitionId: invitation.competitionId,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      })
    } else if (parsed.status === 'declined') {
      await eventBus.emit('teams.invitation.declined', {
        invitationId: invitation.id,
        teamId: invitation.teamId,
        inviteeId: invitation.inviteeId,
        competitionId: invitation.competitionId,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      })
    }

    return invitation
  },
}

registerCommand(createInvitationCommand)
registerCommand(updateInvitationCommand)
