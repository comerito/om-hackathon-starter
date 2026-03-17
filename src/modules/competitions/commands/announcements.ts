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
import { Announcement, AnnouncementPriority } from '../data/entities'
import { createAnnouncementSchema } from '../data/validators'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'

export const announcementCreateSchema = createAnnouncementSchema

const ENTITY_TYPE = 'competitions:announcement' as const

type SerializedAnnouncement = {
  id: string
  competitionId: string
  title: string
  priority: string
  tenantId: string | null
  organizationId: string | null
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
  entityType: ENTITY_TYPE,
  buildUpsertPayload: (ctx: CrudEmitContext<Announcement>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<Announcement>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const createAnnouncementCommand: CommandHandler<Record<string, unknown>, Announcement> = {
  id: 'competitions.announcement.create',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = announcementCreateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const authorId = ctx.auth?.userId
    if (!authorId) throw new CrudHttpError(400, { error: 'Author context is required' })

    const announcement = await de.createOrmEntity({
      entity: Announcement,
      data: {
        competitionId: parsed.competitionId,
        authorId,
        title: parsed.title,
        content: parsed.content,
        priority: (parsed.priority ?? AnnouncementPriority.INFO) as AnnouncementPriority,
        targetRoles: parsed.targetRoles ?? [],
        targetTrackIds: parsed.targetTrackIds ?? [],
        pinned: parsed.pinned ?? false,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: announcement,
      identifiers: {
        id: String(announcement.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: announcementCrudEvents,
      indexer: announcementCrudIndexer,
    })

    return announcement
  },
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('competitions.audit.announcement.create', 'Create announcement'),
      resourceKind: 'competitions.announcement',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      snapshotAfter: serializeAnnouncement(result),
    }
  },
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

const deleteAnnouncementCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, Announcement> = {
  id: 'competitions.announcement.delete',
  isUndoable: false,
  async execute(input, ctx) {
    const id = requireId(input, 'Announcement id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const announcement = await em.findOne(Announcement, {
      id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<Announcement>)
    if (!announcement) throw new CrudHttpError(404, { error: 'Announcement not found' })

    await em.removeAndFlush(announcement)

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: announcement,
      identifiers: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: announcementCrudEvents,
      indexer: announcementCrudIndexer,
    })

    return announcement
  },
  buildLog: async ({ input }) => {
    const { translate } = await resolveTranslations()
    const id = requireId(input, 'Announcement id required')
    return {
      actionLabel: translate('competitions.audit.announcement.delete', 'Delete announcement'),
      resourceKind: 'competitions.announcement',
      resourceId: id,
      tenantId: null,
      organizationId: null,
    }
  },
}

// ---------------------------------------------------------------------------
// Register commands
// ---------------------------------------------------------------------------

registerCommand(createAnnouncementCommand)
registerCommand(deleteAnnouncementCommand)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeAnnouncement(a: Announcement): SerializedAnnouncement {
  return {
    id: String(a.id),
    competitionId: String(a.competitionId),
    title: String(a.title),
    priority: String(a.priority),
    tenantId: a.tenantId ? String(a.tenantId) : null,
    organizationId: a.organizationId ? String(a.organizationId) : null,
  }
}

function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}
