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
import { AgendaItem, AgendaItemType } from '../data/entities'
import { createAgendaItemSchema, updateAgendaItemSchema } from '../data/validators'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'

export const agendaItemCreateSchema = createAgendaItemSchema
export const agendaItemUpdateSchema = updateAgendaItemSchema

const ENTITY_TYPE = 'competitions:agenda_item' as const

type SerializedAgendaItem = {
  id: string
  competitionId: string
  title: string
  type: string
  tenantId: string | null
  organizationId: string | null
}

export const agendaItemCrudEvents: CrudEventsConfig<AgendaItem> = {
  module: 'competitions',
  entity: 'agenda_item',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<AgendaItem>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

export const agendaItemCrudIndexer: CrudIndexerConfig<AgendaItem> = {
  entityType: ENTITY_TYPE,
  buildUpsertPayload: (ctx: CrudEmitContext<AgendaItem>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<AgendaItem>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const createAgendaItemCommand: CommandHandler<Record<string, unknown>, AgendaItem> = {
  id: 'competitions.agenda_item.create',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = agendaItemCreateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const agendaItem = await de.createOrmEntity({
      entity: AgendaItem,
      data: {
        competitionId: parsed.competitionId,
        title: parsed.title,
        description: parsed.description ?? null,
        type: (parsed.type ?? AgendaItemType.CUSTOM) as AgendaItemType,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
        location: parsed.location ?? null,
        speakerName: parsed.speakerName ?? null,
        speakerBio: parsed.speakerBio ?? null,
        trackId: parsed.trackId ?? null,
        isMandatory: parsed.isMandatory ?? false,
        order: parsed.order ?? 0,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: agendaItem,
      identifiers: {
        id: String(agendaItem.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: agendaItemCrudEvents,
      indexer: agendaItemCrudIndexer,
    })

    return agendaItem
  },
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('competitions.audit.agenda_item.create', 'Create agenda item'),
      resourceKind: 'competitions.agenda_item',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      snapshotAfter: serializeAgendaItem(result),
    }
  },
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

const updateAgendaItemCommand: CommandHandler<Record<string, unknown>, AgendaItem> = {
  id: 'competitions.agenda_item.update',
  isUndoable: false,
  async execute(rawInput, ctx) {
    const parsed = agendaItemUpdateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const agendaItem = await de.updateOrmEntity({
      entity: AgendaItem,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<AgendaItem>,
      apply: (entity) => {
        if (parsed.title !== undefined) entity.title = parsed.title
        if (parsed.description !== undefined) entity.description = parsed.description
        if (parsed.type !== undefined) entity.type = parsed.type as AgendaItemType
        if (parsed.startsAt !== undefined) entity.startsAt = parsed.startsAt
        if (parsed.endsAt !== undefined) entity.endsAt = parsed.endsAt
        if (parsed.location !== undefined) entity.location = parsed.location
        if (parsed.speakerName !== undefined) entity.speakerName = parsed.speakerName
        if (parsed.speakerBio !== undefined) entity.speakerBio = parsed.speakerBio
        if (parsed.trackId !== undefined) entity.trackId = parsed.trackId
        if (parsed.isMandatory !== undefined) entity.isMandatory = parsed.isMandatory
        if (parsed.order !== undefined) entity.order = parsed.order
      },
    })
    if (!agendaItem) throw new CrudHttpError(404, { error: 'Agenda item not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: agendaItem,
      identifiers: {
        id: String(agendaItem.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: agendaItemCrudEvents,
      indexer: agendaItemCrudIndexer,
    })

    return agendaItem
  },
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('competitions.audit.agenda_item.update', 'Update agenda item'),
      resourceKind: 'competitions.agenda_item',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
    }
  },
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

const deleteAgendaItemCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, AgendaItem> = {
  id: 'competitions.agenda_item.delete',
  isUndoable: false,
  async execute(input, ctx) {
    const id = requireId(input, 'Agenda item id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine
    const em = ctx.container.resolve('em') as EntityManager

    const agendaItem = await em.findOne(AgendaItem, {
      id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<AgendaItem>)
    if (!agendaItem) throw new CrudHttpError(404, { error: 'Agenda item not found' })

    await em.removeAndFlush(agendaItem)

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: agendaItem,
      identifiers: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: agendaItemCrudEvents,
      indexer: agendaItemCrudIndexer,
    })

    return agendaItem
  },
  buildLog: async ({ input }) => {
    const { translate } = await resolveTranslations()
    const id = requireId(input, 'Agenda item id required')
    return {
      actionLabel: translate('competitions.audit.agenda_item.delete', 'Delete agenda item'),
      resourceKind: 'competitions.agenda_item',
      resourceId: id,
      tenantId: null,
      organizationId: null,
    }
  },
}

// ---------------------------------------------------------------------------
// Register commands
// ---------------------------------------------------------------------------

registerCommand(createAgendaItemCommand)
registerCommand(updateAgendaItemCommand)
registerCommand(deleteAgendaItemCommand)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeAgendaItem(item: AgendaItem): SerializedAgendaItem {
  return {
    id: String(item.id),
    competitionId: String(item.competitionId),
    title: String(item.title),
    type: String(item.type),
    tenantId: item.tenantId ? String(item.tenantId) : null,
    organizationId: item.organizationId ? String(item.organizationId) : null,
  }
}

function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}
