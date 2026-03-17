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
import { Sponsor, Prize } from '../data/entities'
import {
  createSponsorSchema,
  updateSponsorSchema,
  createPrizeSchema,
  updatePrizeSchema,
} from '../data/validators'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'

// ---------------------------------------------------------------------------
// Sponsor CRUD
// ---------------------------------------------------------------------------

const SPONSOR_ENTITY_TYPE = 'sponsors:sponsor' as const

export const sponsorCrudEvents: CrudEventsConfig<Sponsor> = {
  module: 'sponsors',
  entity: 'sponsor',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<Sponsor>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

export const sponsorCrudIndexer: CrudIndexerConfig<Sponsor> = {
  entityType: SPONSOR_ENTITY_TYPE,
  buildUpsertPayload: (ctx: CrudEmitContext<Sponsor>) => ({
    entityType: SPONSOR_ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<Sponsor>) => ({
    entityType: SPONSOR_ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

type SerializedSponsor = {
  id: string
  competitionId: string
  name: string
  tier: string
  logoUrl: string
  websiteUrl: string | null
  description: string | null
  challengeTitle: string | null
  challengeDescription: string | null
  challengeResourcesUrl: string | null
  contactName: string | null
  contactEmail: string | null
  order: number
  isVisible: boolean
  isActive: boolean
  tenantId: string | null
  organizationId: string | null
}

function serializeSponsor(s: Sponsor): SerializedSponsor {
  return {
    id: String(s.id),
    competitionId: String(s.competitionId),
    name: String(s.name),
    tier: String(s.tier),
    logoUrl: String(s.logoUrl),
    websiteUrl: s.websiteUrl ? String(s.websiteUrl) : null,
    description: s.description ? String(s.description) : null,
    challengeTitle: s.challengeTitle ? String(s.challengeTitle) : null,
    challengeDescription: s.challengeDescription ? String(s.challengeDescription) : null,
    challengeResourcesUrl: s.challengeResourcesUrl ? String(s.challengeResourcesUrl) : null,
    contactName: s.contactName ? String(s.contactName) : null,
    contactEmail: s.contactEmail ? String(s.contactEmail) : null,
    order: s.order,
    isVisible: Boolean(s.isVisible),
    isActive: Boolean(s.isActive),
    tenantId: s.tenantId ? String(s.tenantId) : null,
    organizationId: s.organizationId ? String(s.organizationId) : null,
  }
}

const createSponsorCommand: CommandHandler<Record<string, unknown>, Sponsor> = {
  id: 'sponsors.sponsor.create',
  isUndoable: true,
  async execute(rawInput, ctx) {
    const parsed = createSponsorSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const sponsor = await de.createOrmEntity({
      entity: Sponsor,
      data: {
        competitionId: parsed.competitionId,
        name: parsed.name,
        tier: parsed.tier as Sponsor['tier'],
        logoUrl: parsed.logoUrl,
        websiteUrl: parsed.websiteUrl ?? null,
        description: parsed.description ?? null,
        challengeTitle: parsed.challengeTitle ?? null,
        challengeDescription: parsed.challengeDescription ?? null,
        challengeResourcesUrl: parsed.challengeResourcesUrl ?? null,
        contactName: parsed.contactName ?? null,
        contactEmail: parsed.contactEmail ?? null,
        order: parsed.order ?? 0,
        isVisible: parsed.isVisible ?? true,
        isActive: true,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: sponsor,
      identifiers: {
        id: String(sponsor.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: sponsorCrudEvents,
      indexer: sponsorCrudIndexer,
    })

    return sponsor
  },
  captureAfter: (_input, result) => serializeSponsor(result),
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('sponsors.audit.sponsor.create', 'Create sponsor'),
      resourceKind: 'sponsors.sponsor',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      snapshotAfter: serializeSponsor(result),
    }
  },
  async undo({ logEntry, ctx }) {
    const snapshot = logEntry.snapshotAfter as SerializedSponsor | undefined
    const id = snapshot?.id ?? logEntry.resourceId
    if (!id) throw new Error('Missing sponsor id for undo')
    const scope = resolveUndoScope(ctx, snapshot)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    await de.deleteOrmEntity({
      entity: Sponsor,
      where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<Sponsor>,
      soft: false,
    })

    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: null as unknown as Sponsor,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: sponsorCrudEvents,
      indexer: sponsorCrudIndexer,
    })
  },
}

const updateSponsorCommand: CommandHandler<Record<string, unknown>, Sponsor> = {
  id: 'sponsors.sponsor.update',
  isUndoable: true,
  async prepare(rawInput, ctx) {
    const parsed = updateSponsorSchema.parse(rawInput)
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(Sponsor, { id: parsed.id } as FilterQuery<Sponsor>)
    if (!existing) throw new CrudHttpError(404, { error: 'Sponsor not found' })
    return { before: serializeSponsor(existing) }
  },
  async execute(rawInput, ctx) {
    const parsed = updateSponsorSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const sponsor = await de.updateOrmEntity({
      entity: Sponsor,
      where: { id: parsed.id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<Sponsor>,
      apply: (entity) => {
        if (parsed.name !== undefined) entity.name = parsed.name
        if (parsed.tier !== undefined) entity.tier = parsed.tier as Sponsor['tier']
        if (parsed.logoUrl !== undefined) entity.logoUrl = parsed.logoUrl
        if (parsed.websiteUrl !== undefined) entity.websiteUrl = parsed.websiteUrl
        if (parsed.description !== undefined) entity.description = parsed.description
        if (parsed.challengeTitle !== undefined) entity.challengeTitle = parsed.challengeTitle
        if (parsed.challengeDescription !== undefined) entity.challengeDescription = parsed.challengeDescription
        if (parsed.challengeResourcesUrl !== undefined) entity.challengeResourcesUrl = parsed.challengeResourcesUrl
        if (parsed.contactName !== undefined) entity.contactName = parsed.contactName
        if (parsed.contactEmail !== undefined) entity.contactEmail = parsed.contactEmail
        if (parsed.order !== undefined) entity.order = parsed.order
        if (parsed.isVisible !== undefined) entity.isVisible = parsed.isVisible
        if (parsed.isActive !== undefined) entity.isActive = parsed.isActive
      },
    })
    if (!sponsor) throw new CrudHttpError(404, { error: 'Sponsor not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: sponsor,
      identifiers: { id: String(sponsor.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: sponsorCrudEvents,
      indexer: sponsorCrudIndexer,
    })

    return sponsor
  },
  captureAfter: (_input, result) => serializeSponsor(result),
  buildLog: async ({ result, snapshots }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as SerializedSponsor | undefined
    const after = serializeSponsor(result)
    const changes = buildChanges(
      before ?? null,
      after as unknown as Record<string, unknown>,
      ['name', 'tier', 'logoUrl', 'websiteUrl', 'description', 'challengeTitle', 'order', 'isVisible', 'isActive'],
    )
    return {
      actionLabel: translate('sponsors.audit.sponsor.update', 'Update sponsor'),
      resourceKind: 'sponsors.sponsor',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      changes,
      snapshotBefore: before ?? null,
      snapshotAfter: after,
    }
  },
  async undo({ logEntry, ctx }) {
    const before = logEntry.snapshotBefore as SerializedSponsor | undefined
    if (!before?.id) throw new Error('Missing previous snapshot for undo')
    const scope = resolveUndoScope(ctx, before)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    await de.updateOrmEntity({
      entity: Sponsor,
      where: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<Sponsor>,
      apply: (entity) => {
        entity.name = before.name
        entity.tier = before.tier as Sponsor['tier']
        entity.logoUrl = before.logoUrl
        entity.websiteUrl = before.websiteUrl
        entity.description = before.description
        entity.challengeTitle = before.challengeTitle
        entity.challengeDescription = before.challengeDescription
        entity.challengeResourcesUrl = before.challengeResourcesUrl
        entity.contactName = before.contactName
        entity.contactEmail = before.contactEmail
        entity.order = before.order
        entity.isVisible = before.isVisible
        entity.isActive = before.isActive
      },
    })

    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: null as unknown as Sponsor,
      identifiers: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: sponsorCrudEvents,
      indexer: sponsorCrudIndexer,
    })
  },
}

const deleteSponsorCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, Sponsor> = {
  id: 'sponsors.sponsor.delete',
  isUndoable: true,
  async prepare(input, ctx) {
    const id = requireId(input, 'Sponsor id required')
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(Sponsor, { id } as FilterQuery<Sponsor>)
    if (!existing) return {}
    return { before: serializeSponsor(existing) }
  },
  async execute(input, ctx) {
    const id = requireId(input, 'Sponsor id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const sponsor = await de.deleteOrmEntity({
      entity: Sponsor,
      where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<Sponsor>,
      soft: false,
    })
    if (!sponsor) throw new CrudHttpError(404, { error: 'Sponsor not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: sponsor,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: sponsorCrudEvents,
      indexer: sponsorCrudIndexer,
    })

    return sponsor
  },
  buildLog: async ({ snapshots, input }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as SerializedSponsor | undefined
    const id = requireId(input, 'Sponsor id required')
    return {
      actionLabel: translate('sponsors.audit.sponsor.delete', 'Delete sponsor'),
      resourceKind: 'sponsors.sponsor',
      resourceId: id,
      tenantId: before?.tenantId ?? null,
      organizationId: before?.organizationId ?? null,
      snapshotBefore: before ?? null,
    }
  },
  async undo({ logEntry, ctx }) {
    const before = logEntry.snapshotBefore as SerializedSponsor | undefined
    if (!before?.id) throw new Error('Missing snapshot for undo')
    const scope = resolveUndoScope(ctx, before)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    await de.createOrmEntity({
      entity: Sponsor,
      data: {
        id: before.id,
        competitionId: before.competitionId,
        name: before.name,
        tier: before.tier as Sponsor['tier'],
        logoUrl: before.logoUrl,
        websiteUrl: before.websiteUrl,
        description: before.description,
        challengeTitle: before.challengeTitle,
        challengeDescription: before.challengeDescription,
        challengeResourcesUrl: before.challengeResourcesUrl,
        contactName: before.contactName,
        contactEmail: before.contactEmail,
        order: before.order,
        isVisible: before.isVisible,
        isActive: before.isActive,
        tenantId: before.tenantId ?? scope.tenantId,
        organizationId: before.organizationId ?? scope.organizationId,
      },
    })

    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: null as unknown as Sponsor,
      identifiers: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: sponsorCrudEvents,
      indexer: sponsorCrudIndexer,
    })
  },
}

// ---------------------------------------------------------------------------
// Prize CRUD
// ---------------------------------------------------------------------------

const PRIZE_ENTITY_TYPE = 'sponsors:prize' as const

export const prizeCrudEvents: CrudEventsConfig<Prize> = {
  module: 'sponsors',
  entity: 'prize',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<Prize>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

export const prizeCrudIndexer: CrudIndexerConfig<Prize> = {
  entityType: PRIZE_ENTITY_TYPE,
  buildUpsertPayload: (ctx: CrudEmitContext<Prize>) => ({
    entityType: PRIZE_ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<Prize>) => ({
    entityType: PRIZE_ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

type SerializedPrize = {
  id: string
  competitionId: string
  name: string
  description: string | null
  category: string
  trackId: string | null
  sponsorId: string | null
  value: string | null
  rank: number | null
  iconUrl: string | null
  winningProjectId: string | null
  winningTeamId: string | null
  awardedAt: string | null
  awardedBy: string | null
  order: number
  tenantId: string | null
  organizationId: string | null
}

function serializePrize(p: Prize): SerializedPrize {
  return {
    id: String(p.id),
    competitionId: String(p.competitionId),
    name: String(p.name),
    description: p.description ? String(p.description) : null,
    category: String(p.category),
    trackId: p.trackId ? String(p.trackId) : null,
    sponsorId: p.sponsorId ? String(p.sponsorId) : null,
    value: p.value ? String(p.value) : null,
    rank: p.rank ?? null,
    iconUrl: p.iconUrl ? String(p.iconUrl) : null,
    winningProjectId: p.winningProjectId ? String(p.winningProjectId) : null,
    winningTeamId: p.winningTeamId ? String(p.winningTeamId) : null,
    awardedAt: p.awardedAt ? p.awardedAt.toISOString() : null,
    awardedBy: p.awardedBy ? String(p.awardedBy) : null,
    order: p.order,
    tenantId: p.tenantId ? String(p.tenantId) : null,
    organizationId: p.organizationId ? String(p.organizationId) : null,
  }
}

const createPrizeCommand: CommandHandler<Record<string, unknown>, Prize> = {
  id: 'sponsors.prize.create',
  isUndoable: true,
  async execute(rawInput, ctx) {
    const parsed = createPrizeSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const prize = await de.createOrmEntity({
      entity: Prize,
      data: {
        competitionId: parsed.competitionId,
        name: parsed.name,
        description: parsed.description ?? null,
        category: parsed.category as Prize['category'],
        trackId: parsed.trackId ?? null,
        sponsorId: parsed.sponsorId ?? null,
        value: parsed.value ?? null,
        rank: parsed.rank ?? null,
        iconUrl: parsed.iconUrl ?? null,
        order: parsed.order ?? 0,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: prize,
      identifiers: { id: String(prize.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: prizeCrudEvents,
      indexer: prizeCrudIndexer,
    })

    return prize
  },
  captureAfter: (_input, result) => serializePrize(result),
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('sponsors.audit.prize.create', 'Create prize'),
      resourceKind: 'sponsors.prize',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      snapshotAfter: serializePrize(result),
    }
  },
  async undo({ logEntry, ctx }) {
    const snapshot = logEntry.snapshotAfter as SerializedPrize | undefined
    const id = snapshot?.id ?? logEntry.resourceId
    if (!id) throw new Error('Missing prize id for undo')
    const scope = resolveUndoScope(ctx, snapshot)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    await de.deleteOrmEntity({
      entity: Prize,
      where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<Prize>,
      soft: false,
    })

    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: null as unknown as Prize,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: prizeCrudEvents,
      indexer: prizeCrudIndexer,
    })
  },
}

const updatePrizeCommand: CommandHandler<Record<string, unknown>, Prize> = {
  id: 'sponsors.prize.update',
  isUndoable: true,
  async prepare(rawInput, ctx) {
    const parsed = updatePrizeSchema.parse(rawInput)
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(Prize, { id: parsed.id } as FilterQuery<Prize>)
    if (!existing) throw new CrudHttpError(404, { error: 'Prize not found' })
    return { before: serializePrize(existing) }
  },
  async execute(rawInput, ctx) {
    const parsed = updatePrizeSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const prize = await de.updateOrmEntity({
      entity: Prize,
      where: { id: parsed.id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<Prize>,
      apply: (entity) => {
        if (parsed.name !== undefined) entity.name = parsed.name
        if (parsed.description !== undefined) entity.description = parsed.description
        if (parsed.category !== undefined) entity.category = parsed.category as Prize['category']
        if (parsed.trackId !== undefined) entity.trackId = parsed.trackId
        if (parsed.sponsorId !== undefined) entity.sponsorId = parsed.sponsorId
        if (parsed.value !== undefined) entity.value = parsed.value
        if (parsed.rank !== undefined) entity.rank = parsed.rank
        if (parsed.iconUrl !== undefined) entity.iconUrl = parsed.iconUrl
        if (parsed.order !== undefined) entity.order = parsed.order
      },
    })
    if (!prize) throw new CrudHttpError(404, { error: 'Prize not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: prize,
      identifiers: { id: String(prize.id), tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: prizeCrudEvents,
      indexer: prizeCrudIndexer,
    })

    return prize
  },
  captureAfter: (_input, result) => serializePrize(result),
  buildLog: async ({ result, snapshots }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as SerializedPrize | undefined
    const after = serializePrize(result)
    const changes = buildChanges(
      before ?? null,
      after as unknown as Record<string, unknown>,
      ['name', 'description', 'category', 'trackId', 'sponsorId', 'value', 'rank', 'order'],
    )
    return {
      actionLabel: translate('sponsors.audit.prize.update', 'Update prize'),
      resourceKind: 'sponsors.prize',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      changes,
      snapshotBefore: before ?? null,
      snapshotAfter: after,
    }
  },
  async undo({ logEntry, ctx }) {
    const before = logEntry.snapshotBefore as SerializedPrize | undefined
    if (!before?.id) throw new Error('Missing previous snapshot for undo')
    const scope = resolveUndoScope(ctx, before)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    await de.updateOrmEntity({
      entity: Prize,
      where: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<Prize>,
      apply: (entity) => {
        entity.name = before.name
        entity.description = before.description
        entity.category = before.category as Prize['category']
        entity.trackId = before.trackId
        entity.sponsorId = before.sponsorId
        entity.value = before.value
        entity.rank = before.rank
        entity.iconUrl = before.iconUrl
        entity.order = before.order
      },
    })

    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: null as unknown as Prize,
      identifiers: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: prizeCrudEvents,
      indexer: prizeCrudIndexer,
    })
  },
}

const deletePrizeCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, Prize> = {
  id: 'sponsors.prize.delete',
  isUndoable: true,
  async prepare(input, ctx) {
    const id = requireId(input, 'Prize id required')
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(Prize, { id } as FilterQuery<Prize>)
    if (!existing) return {}
    return { before: serializePrize(existing) }
  },
  async execute(input, ctx) {
    const id = requireId(input, 'Prize id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const prize = await de.deleteOrmEntity({
      entity: Prize,
      where: { id, tenantId: scope.tenantId, organizationId: scope.organizationId } as FilterQuery<Prize>,
      soft: false,
    })
    if (!prize) throw new CrudHttpError(404, { error: 'Prize not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: prize,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: prizeCrudEvents,
      indexer: prizeCrudIndexer,
    })

    return prize
  },
  buildLog: async ({ snapshots, input }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as SerializedPrize | undefined
    const id = requireId(input, 'Prize id required')
    return {
      actionLabel: translate('sponsors.audit.prize.delete', 'Delete prize'),
      resourceKind: 'sponsors.prize',
      resourceId: id,
      tenantId: before?.tenantId ?? null,
      organizationId: before?.organizationId ?? null,
      snapshotBefore: before ?? null,
    }
  },
  async undo({ logEntry, ctx }) {
    const before = logEntry.snapshotBefore as SerializedPrize | undefined
    if (!before?.id) throw new Error('Missing snapshot for undo')
    const scope = resolveUndoScope(ctx, before)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    await de.createOrmEntity({
      entity: Prize,
      data: {
        id: before.id,
        competitionId: before.competitionId,
        name: before.name,
        description: before.description,
        category: before.category as Prize['category'],
        trackId: before.trackId,
        sponsorId: before.sponsorId,
        value: before.value,
        rank: before.rank,
        iconUrl: before.iconUrl,
        order: before.order,
        tenantId: before.tenantId ?? scope.tenantId,
        organizationId: before.organizationId ?? scope.organizationId,
      },
    })

    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: null as unknown as Prize,
      identifiers: { id: before.id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: prizeCrudEvents,
      indexer: prizeCrudIndexer,
    })
  },
}

// ---------------------------------------------------------------------------
// Register commands
// ---------------------------------------------------------------------------

registerCommand(createSponsorCommand)
registerCommand(updateSponsorCommand)
registerCommand(deleteSponsorCommand)
registerCommand(createPrizeCommand)
registerCommand(updatePrizeCommand)
registerCommand(deletePrizeCommand)

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

function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}
