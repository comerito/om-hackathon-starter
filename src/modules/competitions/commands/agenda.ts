import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { FilterQuery } from '@mikro-orm/postgresql'
import { AgendaItem } from '../data/entities'
import { createAgendaItemSchema, updateAgendaItemSchema } from '../data/validators'

const ENTITY_ID = 'competitions:agenda_item'

function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}

export const agendaCrudEvents: CrudEventsConfig<AgendaItem> = {
  module: 'competitions',
  entity: 'agenda_item',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<AgendaItem>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

export const agendaCrudIndexer: CrudIndexerConfig<AgendaItem> = {
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<AgendaItem>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<AgendaItem>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

const createAgendaItemCommand: CommandHandler<Record<string, unknown>, AgendaItem> = {
  id: 'competitions.agenda.create',
  async execute(rawInput, ctx) {
    const parsed = createAgendaItemSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const item = await de.createOrmEntity({
      entity: AgendaItem,
      data: {
        competitionId: parsed.competition_id,
        title: parsed.title,
        description: parsed.description ?? null,
        type: parsed.type,
        startsAt: new Date(parsed.starts_at),
        endsAt: new Date(parsed.ends_at),
        location: parsed.location ?? null,
        speakerName: parsed.speaker_name ?? null,
        speakerBio: parsed.speaker_bio ?? null,
        trackId: parsed.track_id ?? null,
        isMandatory: parsed.is_mandatory,
        order: parsed.order,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: item,
      identifiers: { id: String(item.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: agendaCrudEvents,
      indexer: agendaCrudIndexer,
    })

    return item
  },
}

const updateAgendaItemCommand: CommandHandler<Record<string, unknown>, AgendaItem> = {
  id: 'competitions.agenda.update',
  async execute(rawInput, ctx) {
    const parsed = updateAgendaItemSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const item = await de.updateOrmEntity({
      entity: AgendaItem,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<AgendaItem>,
      apply: (entity) => {
        if (parsed.title !== undefined) entity.title = parsed.title
        if (parsed.description !== undefined) entity.description = parsed.description
        if (parsed.type !== undefined) entity.type = parsed.type
        if (parsed.starts_at !== undefined) entity.startsAt = new Date(parsed.starts_at)
        if (parsed.ends_at !== undefined) entity.endsAt = new Date(parsed.ends_at)
        if (parsed.location !== undefined) entity.location = parsed.location
        if (parsed.speaker_name !== undefined) entity.speakerName = parsed.speaker_name
        if (parsed.speaker_bio !== undefined) entity.speakerBio = parsed.speaker_bio
        if (parsed.track_id !== undefined) entity.trackId = parsed.track_id
        if (parsed.is_mandatory !== undefined) entity.isMandatory = parsed.is_mandatory
        if (parsed.order !== undefined) entity.order = parsed.order
      },
    })
    if (!item) throw new CrudHttpError(404, { error: 'Agenda item not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: item,
      identifiers: { id: String(item.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: agendaCrudEvents,
      indexer: agendaCrudIndexer,
    })

    return item
  },
}

const deleteAgendaItemCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, AgendaItem> = {
  id: 'competitions.agenda.delete',
  async execute(input, ctx) {
    const id = requireId(input, 'Agenda item id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const item = await de.deleteOrmEntity({
      entity: AgendaItem,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<AgendaItem>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    if (!item) throw new CrudHttpError(404, { error: 'Agenda item not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: item,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: agendaCrudEvents,
      indexer: agendaCrudIndexer,
    })

    return item
  },
}

registerCommand(createAgendaItemCommand)
registerCommand(updateAgendaItemCommand)
registerCommand(deleteAgendaItemCommand)
