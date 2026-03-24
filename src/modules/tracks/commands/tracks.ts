import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { FilterQuery } from '@mikro-orm/postgresql'
import { Track } from '../data/entities'
import { createTrackSchema, updateTrackSchema } from '../data/validators'

const ENTITY_ID = 'tracks:track'

function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
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
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<Track>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<Track>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

const createTrackCommand: CommandHandler<Record<string, unknown>, Track> = {
  id: 'tracks.tracks.create',
  async execute(rawInput, ctx) {
    const parsed = createTrackSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const track = await de.createOrmEntity({
      entity: Track,
      data: {
        competitionId: parsed.competition_id,
        name: parsed.name,
        description: parsed.description ?? null,
        color: parsed.color,
        iconUrl: parsed.icon_url ?? null,
        maxTeams: parsed.max_teams ?? null,
        order: parsed.order,
        mentorIds: parsed.mentor_ids,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: track,
      identifiers: { id: String(track.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: trackCrudEvents,
      indexer: trackCrudIndexer,
    })

    return track
  },
}

const updateTrackCommand: CommandHandler<Record<string, unknown>, Track> = {
  id: 'tracks.tracks.update',
  async execute(rawInput, ctx) {
    const parsed = updateTrackSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const track = await de.updateOrmEntity({
      entity: Track,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<Track>,
      apply: (entity) => {
        if (parsed.competition_id !== undefined) entity.competitionId = parsed.competition_id
        if (parsed.name !== undefined) entity.name = parsed.name
        if (parsed.description !== undefined) entity.description = parsed.description
        if (parsed.color !== undefined) entity.color = parsed.color
        if (parsed.icon_url !== undefined) entity.iconUrl = parsed.icon_url
        if (parsed.max_teams !== undefined) entity.maxTeams = parsed.max_teams
        if (parsed.order !== undefined) entity.order = parsed.order
        if (parsed.mentor_ids !== undefined) entity.mentorIds = parsed.mentor_ids
      },
    })
    if (!track) throw new CrudHttpError(404, { error: 'Track not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: track,
      identifiers: { id: String(track.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: trackCrudEvents,
      indexer: trackCrudIndexer,
    })

    return track
  },
}

const deleteTrackCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, Track> = {
  id: 'tracks.tracks.delete',
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
        deletedAt: null,
      } as FilterQuery<Track>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    if (!track) throw new CrudHttpError(404, { error: 'Track not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: track,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: trackCrudEvents,
      indexer: trackCrudIndexer,
    })

    return track
  },
}

registerCommand(createTrackCommand)
registerCommand(updateTrackCommand)
registerCommand(deleteTrackCommand)
