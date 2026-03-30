import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { Team, TeamStatus, TeamTrack } from '../data/entities'
import { createTeamSchema, updateTeamSchema, disqualifyTeamSchema } from '../data/validators'

const ENTITY_ID = 'teams:team'

export const teamCrudEvents: CrudEventsConfig<Team> = {
  module: 'teams',
  entity: 'team',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<Team>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

export const teamCrudIndexer: CrudIndexerConfig<Team> = {
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<Team>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<Team>) => ({
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

const createTeamCommand: CommandHandler<Record<string, unknown>, Team> = {
  id: 'teams.teams.create',
  async execute(rawInput, ctx) {
    const parsed = createTeamSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    // Resolve track IDs: prefer track_ids array, fall back to single track_id
    const trackIds = parsed.track_ids ?? (parsed.track_id ? [parsed.track_id] : [])

    const team = await de.createOrmEntity({
      entity: Team,
      data: {
        competitionId: parsed.competition_id,
        trackId: trackIds[0] ?? null,
        name: parsed.name,
        description: parsed.description ?? null,
        avatarUrl: parsed.avatar_url ?? null,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    // Create junction entries for multi-track
    if (trackIds.length > 0) {
      const em = ctx.container.resolve('em') as import('@mikro-orm/postgresql').EntityManager
      for (const trackId of trackIds) {
        em.persist(em.create(TeamTrack, {
          teamId: team.id,
          trackId,
          competitionId: parsed.competition_id,
          tenantId: scope.tenantId,
          organizationId: scope.organizationId,
          createdAt: new Date(),
        }))
      }
      await em.flush()
    }

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: team,
      identifiers: {
        id: String(team.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: teamCrudEvents,
      indexer: teamCrudIndexer,
    })

    return team
  },
}

const updateTeamCommand: CommandHandler<Record<string, unknown>, Team> = {
  id: 'teams.teams.update',
  async execute(rawInput, ctx) {
    const parsed = updateTeamSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const team = await de.updateOrmEntity({
      entity: Team,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<Team>,
      apply: (entity) => {
        if (parsed.name !== undefined) entity.name = parsed.name
        if (parsed.description !== undefined) entity.description = parsed.description
        if (parsed.track_id !== undefined) entity.trackId = parsed.track_id
        if (parsed.track_ids !== undefined) entity.trackId = parsed.track_ids[0] ?? null
        if (parsed.avatar_url !== undefined) entity.avatarUrl = parsed.avatar_url
        if (parsed.table_number !== undefined) entity.tableNumber = parsed.table_number
        if (parsed.table_location !== undefined) entity.tableLocation = parsed.table_location
        if (parsed.presentation_order !== undefined) entity.presentationOrder = parsed.presentation_order
        if (parsed.presentation_time_slot !== undefined) entity.presentationTimeSlot = parsed.presentation_time_slot ? new Date(parsed.presentation_time_slot) : null
        if (parsed.is_finalist !== undefined) entity.isFinalist = parsed.is_finalist
      },
    })
    if (!team) throw new CrudHttpError(404, { error: 'Team not found' })

    // Sync junction table if track_ids provided
    if (parsed.track_ids !== undefined) {
      const em = ctx.container.resolve('em') as import('@mikro-orm/postgresql').EntityManager
      const existing = await em.find(TeamTrack, { teamId: team.id } as import('@mikro-orm/postgresql').FilterQuery<TeamTrack>)
      const currentIds = new Set(existing.map(e => e.trackId))
      const desiredIds = new Set(parsed.track_ids)

      for (const entry of existing) {
        if (!desiredIds.has(entry.trackId)) em.remove(entry)
      }
      for (const trackId of parsed.track_ids) {
        if (!currentIds.has(trackId)) {
          em.persist(em.create(TeamTrack, {
            teamId: team.id,
            trackId,
            competitionId: team.competitionId,
            tenantId: scope.tenantId,
            organizationId: scope.organizationId,
            createdAt: new Date(),
          }))
        }
      }
      await em.flush()
    }

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: team,
      identifiers: {
        id: String(team.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: teamCrudEvents,
      indexer: teamCrudIndexer,
    })

    return team
  },
}

const deleteTeamCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, Team> = {
  id: 'teams.teams.delete',
  async execute(input, ctx) {
    const id = requireId(input, 'Team id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const team = await de.deleteOrmEntity({
      entity: Team,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<Team>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    if (!team) throw new CrudHttpError(404, { error: 'Team not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: team,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: teamCrudEvents,
      indexer: teamCrudIndexer,
    })

    return team
  },
}

// ── Disqualify Command ──────────────────────────────────────────────

const disqualifyTeamCommand: CommandHandler<Record<string, unknown>, Team> = {
  id: 'teams.teams.disqualify',
  async execute(rawInput, ctx) {
    const parsed = disqualifyTeamSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const team = await de.updateOrmEntity({
      entity: Team,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<Team>,
      apply: (entity) => {
        entity.status = TeamStatus.DISQUALIFIED
        entity.disqualificationReason = parsed.disqualification_reason
        entity.disqualifiedAt = new Date()
        entity.disqualifiedBy = ctx.auth?.userId ?? ctx.auth?.sub ?? null
      },
    })
    if (!team) throw new CrudHttpError(404, { error: 'Team not found' })

    // Emit disqualified event
    const eventBus = ctx.container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
    await eventBus.emit('teams.team.disqualified', {
      teamId: team.id,
      competitionId: team.competitionId,
      reason: parsed.disqualification_reason,
      disqualifiedBy: ctx.auth?.userId ?? ctx.auth?.sub ?? null,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })

    return team
  },
}

registerCommand(createTeamCommand)
registerCommand(updateTeamCommand)
registerCommand(deleteTeamCommand)
registerCommand(disqualifyTeamCommand)
