import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { FilterQuery } from '@mikro-orm/postgresql'
import { Announcement } from '../data/entities'
import { createAnnouncementSchema } from '../data/validators'

const ENTITY_ID = 'competitions:announcement'

function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}

export const announcementCrudEvents: CrudEventsConfig<Announcement> = {
  module: 'competitions',
  entity: 'announcement',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<Announcement>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

export const announcementCrudIndexer: CrudIndexerConfig<Announcement> = {
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<Announcement>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<Announcement>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

const createAnnouncementCommand: CommandHandler<Record<string, unknown>, Announcement> = {
  id: 'competitions.announcements.create',
  async execute(rawInput, ctx) {
    const parsed = createAnnouncementSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const announcement = await de.createOrmEntity({
      entity: Announcement,
      data: {
        competitionId: parsed.competition_id,
        authorId: ctx.auth?.userId ?? ctx.auth?.sub ?? scope.tenantId,
        title: parsed.title,
        content: parsed.content,
        priority: parsed.priority,
        targetRoles: parsed.target_roles,
        targetTrackIds: parsed.target_track_ids,
        pinned: parsed.pinned,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: announcement,
      identifiers: { id: String(announcement.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: announcementCrudEvents,
      indexer: announcementCrudIndexer,
    })

    return announcement
  },
}

const deleteAnnouncementCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, Announcement> = {
  id: 'competitions.announcements.delete',
  async execute(input, ctx) {
    const id = requireId(input, 'Announcement id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const announcement = await de.deleteOrmEntity({
      entity: Announcement,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<Announcement>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    if (!announcement) throw new CrudHttpError(404, { error: 'Announcement not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: announcement,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: announcementCrudEvents,
      indexer: announcementCrudIndexer,
    })

    return announcement
  },
}

registerCommand(createAnnouncementCommand)
registerCommand(deleteAnnouncementCommand)
