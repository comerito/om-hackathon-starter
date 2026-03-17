import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import {
  emitCrudSideEffects,
  emitCrudUndoSideEffects,
  buildChanges,
  requireId,
} from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { Team } from '../data/entities'
import { createTeamSchema, updateTeamSchema } from '../data/validators'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'

export const teamCreateSchema = createTeamSchema
export const teamUpdateSchema = updateTeamSchema

const ENTITY_TYPE = 'teams:team' as const

type SerializedTeam = {
  id: string
  competitionId: string
  trackId: string | null
  name: string
  description: string | null
  avatarUrl: string | null
  status: string
  isFinalist: boolean
  tableNumber: number | null
  tableLocation: string | null
  presentationOrder: number | null
  isActive: boolean
  tenantId: string | null
  organizationId: string | null
}

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
  entityType: ENTITY_TYPE,
  buildUpsertPayload: (ctx: CrudEmitContext<Team>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<Team>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const createTeamCommand: CommandHandler<Record<string, unknown>, Team> = {
  id: 'teams.team.create',
  isUndoable: true,
  async execute(rawInput, ctx) {
    const parsed = teamCreateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const team = await de.createOrmEntity({
      entity: Team,
      data: {
        competitionId: parsed.competitionId,
        name: parsed.name,
        description: parsed.description ?? null,
        avatarUrl: parsed.avatarUrl ?? null,
        isActive: true,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

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
  captureAfter: (_input, result) => serializeTeam(result),
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('teams.audit.team.create', 'Create team'),
      resourceKind: 'teams.team',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      snapshotAfter: serializeTeam(result),
    }
  },
  async undo({ logEntry, ctx }) {
    const payload = (logEntry?.commandPayload as { undo?: { after?: SerializedTeam } } | undefined)?.undo
    const snapshot = (logEntry.snapshotAfter as SerializedTeam | undefined) ?? payload?.after
    const id = snapshot?.id ?? logEntry.resourceId
    if (!id) throw new Error('Missing team id for undo')
    const scope = resolveUndoScope(ctx, snapshot)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    await de.deleteOrmEntity({
      entity: Team,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<Team>,
      soft: false,
    })

    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: null as unknown as Team,
      identifiers: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: teamCrudEvents,
      indexer: teamCrudIndexer,
    })
  },
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

const updateTeamCommand: CommandHandler<Record<string, unknown>, Team> = {
  id: 'teams.team.update',
  isUndoable: true,
  async prepare(rawInput, ctx) {
    const parsed = teamUpdateSchema.parse(rawInput)
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(Team, { id: parsed.id } as FilterQuery<Team>)
    if (!existing) throw new CrudHttpError(404, { error: 'Team not found' })
    return { before: serializeTeam(existing) }
  },
  async execute(rawInput, ctx) {
    const parsed = teamUpdateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const team = await de.updateOrmEntity({
      entity: Team,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<Team>,
      apply: (entity) => {
        if (parsed.name !== undefined) entity.name = parsed.name
        if (parsed.description !== undefined) entity.description = parsed.description
        if (parsed.avatarUrl !== undefined) entity.avatarUrl = parsed.avatarUrl
        if (parsed.trackId !== undefined) entity.trackId = parsed.trackId
        if (parsed.status !== undefined) entity.status = parsed.status as Team['status']
        if (parsed.presentationOrder !== undefined) entity.presentationOrder = parsed.presentationOrder
        if (parsed.presentationTimeSlot !== undefined) entity.presentationTimeSlot = parsed.presentationTimeSlot ? new Date(parsed.presentationTimeSlot) : null
        if (parsed.isFinalist !== undefined) entity.isFinalist = parsed.isFinalist
        if (parsed.tableNumber !== undefined) entity.tableNumber = parsed.tableNumber
        if (parsed.tableLocation !== undefined) entity.tableLocation = parsed.tableLocation
        if (parsed.isActive !== undefined) entity.isActive = parsed.isActive
      },
    })
    if (!team) throw new CrudHttpError(404, { error: 'Team not found' })

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
  captureAfter: (_input, result) => serializeTeam(result),
  buildLog: async ({ result, snapshots }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as SerializedTeam | undefined
    const after = serializeTeam(result)
    const changes = buildChanges(
      before ?? null,
      after as unknown as Record<string, unknown>,
      ['name', 'description', 'trackId', 'status', 'isFinalist', 'tableNumber', 'tableLocation'],
    )
    return {
      actionLabel: translate('teams.audit.team.update', 'Update team'),
      resourceKind: 'teams.team',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      changes,
      snapshotBefore: before ?? null,
      snapshotAfter: after,
    }
  },
  async undo({ logEntry, ctx }) {
    const payload = (logEntry?.commandPayload as { undo?: { before?: SerializedTeam; after?: SerializedTeam } } | undefined)?.undo
    const before = (logEntry.snapshotBefore as SerializedTeam | undefined) ?? payload?.before
    if (!before?.id) throw new Error('Missing previous snapshot for undo')
    const scope = resolveUndoScope(ctx, before)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const updated = await de.updateOrmEntity({
      entity: Team,
      where: {
        id: before.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<Team>,
      apply: (entity) => {
        entity.name = before.name
        entity.description = before.description
        entity.avatarUrl = before.avatarUrl
        entity.trackId = before.trackId
        entity.status = before.status as Team['status']
        entity.isFinalist = before.isFinalist
        entity.tableNumber = before.tableNumber
        entity.tableLocation = before.tableLocation
        entity.presentationOrder = before.presentationOrder
        entity.isActive = before.isActive
      },
    })

    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: updated,
      identifiers: {
        id: before.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: teamCrudEvents,
      indexer: teamCrudIndexer,
    })
  },
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

const deleteTeamCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, Team> = {
  id: 'teams.team.delete',
  isUndoable: true,
  async prepare(input, ctx) {
    const id = requireId(input, 'Team id required')
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(Team, { id } as FilterQuery<Team>)
    if (!existing) return {}
    return { before: serializeTeam(existing) }
  },
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
      } as FilterQuery<Team>,
      soft: false,
    })
    if (!team) throw new CrudHttpError(404, { error: 'Team not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: team,
      identifiers: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: teamCrudEvents,
      indexer: teamCrudIndexer,
    })

    return team
  },
  buildLog: async ({ snapshots, input }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as SerializedTeam | undefined
    const id = requireId(input, 'Team id required')
    return {
      actionLabel: translate('teams.audit.team.delete', 'Delete team'),
      resourceKind: 'teams.team',
      resourceId: id,
      tenantId: before?.tenantId ?? null,
      organizationId: before?.organizationId ?? null,
      snapshotBefore: before ?? null,
    }
  },
  async undo({ logEntry, ctx }) {
    const before = logEntry.snapshotBefore as SerializedTeam | undefined
    if (!before?.id) throw new Error('Missing snapshot for undo')
    const scope = resolveUndoScope(ctx, before)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    await de.createOrmEntity({
      entity: Team,
      data: {
        id: before.id,
        competitionId: before.competitionId,
        name: before.name,
        description: before.description,
        avatarUrl: before.avatarUrl,
        trackId: before.trackId,
        status: before.status as Team['status'],
        isFinalist: before.isFinalist,
        tableNumber: before.tableNumber,
        tableLocation: before.tableLocation,
        presentationOrder: before.presentationOrder,
        isActive: before.isActive,
        tenantId: before.tenantId ?? scope.tenantId,
        organizationId: before.organizationId ?? scope.organizationId,
      },
    })

    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: null as unknown as Team,
      identifiers: {
        id: before.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: teamCrudEvents,
      indexer: teamCrudIndexer,
    })
  },
}

// ---------------------------------------------------------------------------
// Register commands
// ---------------------------------------------------------------------------

registerCommand(createTeamCommand)
registerCommand(updateTeamCommand)
registerCommand(deleteTeamCommand)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveUndoScope(
  ctx: CommandRuntimeContext,
  snapshot?: { tenantId: string | null; organizationId: string | null },
): { tenantId: string; organizationId: string } {
  const scope = ensureScope(ctx)
  const tenantId = snapshot?.tenantId ?? scope.tenantId
  if (tenantId !== scope.tenantId) {
    throw new CrudHttpError(403, { error: 'Undo scope does not match tenant' })
  }
  let organizationId = scope.organizationId
  if (snapshot?.organizationId) {
    const allowed = Array.isArray(ctx.organizationIds) ? ctx.organizationIds : null
    if (allowed && allowed.length > 0 && !allowed.includes(snapshot.organizationId)) {
      throw new CrudHttpError(403, { error: 'Undo scope is not permitted for this organization' })
    }
    organizationId = snapshot.organizationId
  }
  return { tenantId, organizationId }
}

function serializeTeam(team: Team): SerializedTeam {
  return {
    id: String(team.id),
    competitionId: String(team.competitionId),
    trackId: team.trackId ? String(team.trackId) : null,
    name: String(team.name),
    description: team.description ? String(team.description) : null,
    avatarUrl: team.avatarUrl ? String(team.avatarUrl) : null,
    status: String(team.status),
    isFinalist: Boolean(team.isFinalist),
    tableNumber: team.tableNumber ?? null,
    tableLocation: team.tableLocation ? String(team.tableLocation) : null,
    presentationOrder: team.presentationOrder ?? null,
    isActive: Boolean(team.isActive),
    tenantId: team.tenantId ? String(team.tenantId) : null,
    organizationId: team.organizationId ? String(team.organizationId) : null,
  }
}

function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}
