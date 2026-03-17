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
import { Track } from '../data/entities'
import { createTrackSchema, updateTrackSchema } from '../data/validators'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'

// Re-export create/update schemas for use in route
export const trackCreateSchema = createTrackSchema
export const trackUpdateSchema = updateTrackSchema

const ENTITY_TYPE = 'tracks:track' as const

type SerializedTrack = {
  id: string
  competitionId: string
  name: string
  description: string | null
  color: string
  iconUrl: string | null
  maxTeams: number | null
  order: number
  mentorIds: string[]
  isActive: boolean
  tenantId: string | null
  organizationId: string | null
}

export const trackCrudEvents: CrudEventsConfig<Track> = {
  module: 'tracks',
  entity: 'track',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<Track>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

export const trackCrudIndexer: CrudIndexerConfig<Track> = {
  entityType: ENTITY_TYPE,
  buildUpsertPayload: (ctx: CrudEmitContext<Track>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<Track>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const createTrackCommand: CommandHandler<Record<string, unknown>, Track> = {
  id: 'tracks.track.create',
  isUndoable: true,
  async execute(rawInput, ctx) {
    const parsed = trackCreateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const track = await de.createOrmEntity({
      entity: Track,
      data: {
        competitionId: parsed.competitionId,
        name: parsed.name,
        description: parsed.description ?? null,
        color: parsed.color ?? '#6366f1',
        iconUrl: parsed.iconUrl ?? null,
        maxTeams: parsed.maxTeams ?? null,
        order: parsed.order ?? 0,
        mentorIds: parsed.mentorIds ?? [],
        isActive: true,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: track,
      identifiers: {
        id: String(track.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: trackCrudEvents,
      indexer: trackCrudIndexer,
    })

    return track
  },
  captureAfter: (_input, result) => serializeTrack(result),
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('tracks.audit.track.create', 'Create track'),
      resourceKind: 'tracks.track',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      snapshotAfter: serializeTrack(result),
    }
  },
  async undo({ logEntry, ctx }) {
    const payload = (logEntry?.commandPayload as { undo?: { after?: SerializedTrack } } | undefined)?.undo
    const snapshot = (logEntry.snapshotAfter as SerializedTrack | undefined) ?? payload?.after
    const id = snapshot?.id ?? logEntry.resourceId
    if (!id) throw new Error('Missing track id for undo')
    const scope = resolveUndoScope(ctx, snapshot)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    await de.deleteOrmEntity({
      entity: Track,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<Track>,
      soft: false,
    })

    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: null as unknown as Track,
      identifiers: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: trackCrudEvents,
      indexer: trackCrudIndexer,
    })
  },
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

const updateTrackCommand: CommandHandler<Record<string, unknown>, Track> = {
  id: 'tracks.track.update',
  isUndoable: true,
  async prepare(rawInput, ctx) {
    const parsed = trackUpdateSchema.parse(rawInput)
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(Track, { id: parsed.id } as FilterQuery<Track>)
    if (!existing) throw new CrudHttpError(404, { error: 'Track not found' })
    return { before: serializeTrack(existing) }
  },
  async execute(rawInput, ctx) {
    const parsed = trackUpdateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const track = await de.updateOrmEntity({
      entity: Track,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<Track>,
      apply: (entity) => {
        if (parsed.name !== undefined) entity.name = parsed.name
        if (parsed.description !== undefined) entity.description = parsed.description
        if (parsed.color !== undefined) entity.color = parsed.color
        if (parsed.iconUrl !== undefined) entity.iconUrl = parsed.iconUrl
        if (parsed.maxTeams !== undefined) entity.maxTeams = parsed.maxTeams
        if (parsed.order !== undefined) entity.order = parsed.order
        if (parsed.mentorIds !== undefined) entity.mentorIds = parsed.mentorIds
        if (parsed.isActive !== undefined) entity.isActive = parsed.isActive
      },
    })
    if (!track) throw new CrudHttpError(404, { error: 'Track not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: track,
      identifiers: {
        id: String(track.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: trackCrudEvents,
      indexer: trackCrudIndexer,
    })

    return track
  },
  captureAfter: (_input, result) => serializeTrack(result),
  buildLog: async ({ result, snapshots }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as SerializedTrack | undefined
    const after = serializeTrack(result)
    const changes = buildChanges(
      before ?? null,
      after as unknown as Record<string, unknown>,
      ['name', 'description', 'color', 'maxTeams', 'order'],
    )
    return {
      actionLabel: translate('tracks.audit.track.update', 'Update track'),
      resourceKind: 'tracks.track',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      changes,
      snapshotBefore: before ?? null,
      snapshotAfter: after,
    }
  },
  async undo({ logEntry, ctx }) {
    const payload = (logEntry?.commandPayload as { undo?: { before?: SerializedTrack; after?: SerializedTrack } } | undefined)?.undo
    const before = (logEntry.snapshotBefore as SerializedTrack | undefined) ?? payload?.before
    if (!before?.id) throw new Error('Missing previous snapshot for undo')
    const scope = resolveUndoScope(ctx, before)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const updated = await de.updateOrmEntity({
      entity: Track,
      where: {
        id: before.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<Track>,
      apply: (entity) => {
        entity.name = before.name
        entity.description = before.description
        entity.color = before.color
        entity.iconUrl = before.iconUrl
        entity.maxTeams = before.maxTeams
        entity.order = before.order
        entity.mentorIds = before.mentorIds
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
      events: trackCrudEvents,
      indexer: trackCrudIndexer,
    })
  },
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

const deleteTrackCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, Track> = {
  id: 'tracks.track.delete',
  isUndoable: true,
  async prepare(input, ctx) {
    const id = requireId(input, 'Track id required')
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(Track, { id } as FilterQuery<Track>)
    if (!existing) return {}
    return { before: serializeTrack(existing) }
  },
  async execute(input, ctx) {
    const id = requireId(input, 'Track id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const track = await de.deleteOrmEntity({
      entity: Track,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<Track>,
      soft: false,
    })
    if (!track) throw new CrudHttpError(404, { error: 'Track not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: track,
      identifiers: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: trackCrudEvents,
      indexer: trackCrudIndexer,
    })

    return track
  },
  buildLog: async ({ snapshots, input }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as SerializedTrack | undefined
    const id = requireId(input, 'Track id required')
    return {
      actionLabel: translate('tracks.audit.track.delete', 'Delete track'),
      resourceKind: 'tracks.track',
      resourceId: id,
      tenantId: before?.tenantId ?? null,
      organizationId: before?.organizationId ?? null,
      snapshotBefore: before ?? null,
    }
  },
  async undo({ logEntry, ctx }) {
    const before = logEntry.snapshotBefore as SerializedTrack | undefined
    if (!before?.id) throw new Error('Missing snapshot for undo')
    const scope = resolveUndoScope(ctx, before)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    await de.createOrmEntity({
      entity: Track,
      data: {
        id: before.id,
        competitionId: before.competitionId,
        name: before.name,
        description: before.description,
        color: before.color,
        iconUrl: before.iconUrl,
        maxTeams: before.maxTeams,
        order: before.order,
        mentorIds: before.mentorIds,
        isActive: before.isActive,
        tenantId: before.tenantId ?? scope.tenantId,
        organizationId: before.organizationId ?? scope.organizationId,
      },
    })

    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: null as unknown as Track,
      identifiers: {
        id: before.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: trackCrudEvents,
      indexer: trackCrudIndexer,
    })
  },
}

// ---------------------------------------------------------------------------
// Register commands
// ---------------------------------------------------------------------------

registerCommand(createTrackCommand)
registerCommand(updateTrackCommand)
registerCommand(deleteTrackCommand)

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

function serializeTrack(track: Track): SerializedTrack {
  return {
    id: String(track.id),
    competitionId: String(track.competitionId),
    name: String(track.name),
    description: track.description ? String(track.description) : null,
    color: String(track.color),
    iconUrl: track.iconUrl ? String(track.iconUrl) : null,
    maxTeams: track.maxTeams ?? null,
    order: track.order,
    mentorIds: Array.isArray(track.mentorIds) ? track.mentorIds : [],
    isActive: Boolean(track.isActive),
    tenantId: track.tenantId ? String(track.tenantId) : null,
    organizationId: track.organizationId ? String(track.organizationId) : null,
  }
}

function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}
