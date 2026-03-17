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
import { z } from 'zod'
import { Competition, CompetitionStage } from '../data/entities'
import { createCompetitionSchema, updateCompetitionSchema } from '../data/validators'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'

// Re-export create/update schemas for use in route
export const competitionCreateSchema = createCompetitionSchema
export const competitionUpdateSchema = updateCompetitionSchema

const ENTITY_TYPE = 'competitions:competition' as const

type SerializedCompetition = {
  id: string
  name: string
  slug: string
  stage: string
  location: string | null
  startsAt: string | null
  endsAt: string | null
  tenantId: string | null
  organizationId: string | null
}

export const competitionCrudEvents: CrudEventsConfig<Competition> = {
  module: 'competitions',
  entity: 'competition',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<Competition>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

export const competitionCrudIndexer: CrudIndexerConfig<Competition> = {
  entityType: ENTITY_TYPE,
  buildUpsertPayload: (ctx: CrudEmitContext<Competition>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<Competition>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const createCompetitionCommand: CommandHandler<Record<string, unknown>, Competition> = {
  id: 'competitions.competition.create',
  isUndoable: true,
  async execute(rawInput, ctx) {
    const parsed = competitionCreateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const competition = await de.createOrmEntity({
      entity: Competition,
      data: {
        name: parsed.name,
        slug: parsed.slug,
        description: parsed.description ?? null,
        location: parsed.location ?? null,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
        timezone: parsed.timezone,
        stage: (parsed.stage ?? CompetitionStage.DRAFT) as CompetitionStage,
        minTeamSize: parsed.minTeamSize,
        maxTeamSize: parsed.maxTeamSize,
        maxTeamsPerTrack: parsed.maxTeamsPerTrack ?? null,
        allowTrackChange: parsed.allowTrackChange,
        projectSubmissionDeadline: parsed.projectSubmissionDeadline ?? null,
        judgingDeadline: parsed.judgingDeadline ?? null,
        stageConfig: (parsed.stageConfig ?? {}) as Record<string, unknown>,
        demoConfig: (parsed.demoConfig ?? {}) as Record<string, unknown>,
        judgingConfig: (parsed.judgingConfig ?? {}) as Record<string, unknown>,
        peerVotingConfig: (parsed.peerVotingConfig ?? {}) as Record<string, unknown>,
        codeOfConductUrl: parsed.codeOfConductUrl,
        rulesUrl: parsed.rulesUrl ?? null,
        privacyPolicyUrl: parsed.privacyPolicyUrl ?? null,
        coverImageUrl: parsed.coverImageUrl ?? null,
        isActive: parsed.isActive ?? true,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: competition,
      identifiers: {
        id: String(competition.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: competitionCrudEvents,
      indexer: competitionCrudIndexer,
    })

    return competition
  },
  captureAfter: (_input, result) => serializeCompetition(result),
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('competitions.audit.competition.create', 'Create competition'),
      resourceKind: 'competitions.competition',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      snapshotAfter: serializeCompetition(result),
    }
  },
  async undo({ logEntry, ctx }) {
    const payload = (logEntry?.commandPayload as { undo?: { after?: SerializedCompetition } } | undefined)?.undo
    const snapshot = (logEntry.snapshotAfter as SerializedCompetition | undefined) ?? payload?.after
    const id = snapshot?.id ?? logEntry.resourceId
    if (!id) throw new Error('Missing competition id for undo')
    const scope = resolveUndoScope(ctx, snapshot)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    await de.deleteOrmEntity({
      entity: Competition,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<Competition>,
      soft: true,
      softDeleteField: 'deletedAt',
    })

    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: null as unknown as Competition,
      identifiers: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: competitionCrudEvents,
      indexer: competitionCrudIndexer,
    })
  },
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

const updateCompetitionCommand: CommandHandler<Record<string, unknown>, Competition> = {
  id: 'competitions.competition.update',
  isUndoable: true,
  async prepare(rawInput, ctx) {
    const parsed = competitionUpdateSchema.parse(rawInput)
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(Competition, { id: parsed.id, deletedAt: null } as FilterQuery<Competition>)
    if (!existing) throw new CrudHttpError(404, { error: 'Competition not found' })
    return { before: serializeCompetition(existing) }
  },
  async execute(rawInput, ctx) {
    const parsed = competitionUpdateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const competition = await de.updateOrmEntity({
      entity: Competition,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<Competition>,
      apply: (entity) => {
        if (parsed.name !== undefined) entity.name = parsed.name
        if (parsed.slug !== undefined) entity.slug = parsed.slug
        if (parsed.description !== undefined) entity.description = parsed.description
        if (parsed.location !== undefined) entity.location = parsed.location
        if (parsed.startsAt !== undefined) entity.startsAt = parsed.startsAt
        if (parsed.endsAt !== undefined) entity.endsAt = parsed.endsAt
        if (parsed.timezone !== undefined) entity.timezone = parsed.timezone
        if (parsed.stage !== undefined) entity.stage = parsed.stage as CompetitionStage
        if (parsed.minTeamSize !== undefined) entity.minTeamSize = parsed.minTeamSize
        if (parsed.maxTeamSize !== undefined) entity.maxTeamSize = parsed.maxTeamSize
        if (parsed.maxTeamsPerTrack !== undefined) entity.maxTeamsPerTrack = parsed.maxTeamsPerTrack
        if (parsed.allowTrackChange !== undefined) entity.allowTrackChange = parsed.allowTrackChange
        if (parsed.projectSubmissionDeadline !== undefined) entity.projectSubmissionDeadline = parsed.projectSubmissionDeadline
        if (parsed.judgingDeadline !== undefined) entity.judgingDeadline = parsed.judgingDeadline
        if (parsed.stageConfig !== undefined) entity.stageConfig = parsed.stageConfig as Record<string, unknown>
        if (parsed.demoConfig !== undefined) entity.demoConfig = parsed.demoConfig as Record<string, unknown>
        if (parsed.judgingConfig !== undefined) entity.judgingConfig = parsed.judgingConfig as Record<string, unknown>
        if (parsed.peerVotingConfig !== undefined) entity.peerVotingConfig = parsed.peerVotingConfig as Record<string, unknown>
        if (parsed.codeOfConductUrl !== undefined) entity.codeOfConductUrl = parsed.codeOfConductUrl
        if (parsed.rulesUrl !== undefined) entity.rulesUrl = parsed.rulesUrl
        if (parsed.privacyPolicyUrl !== undefined) entity.privacyPolicyUrl = parsed.privacyPolicyUrl
        if (parsed.coverImageUrl !== undefined) entity.coverImageUrl = parsed.coverImageUrl
        if (parsed.isActive !== undefined) entity.isActive = parsed.isActive
      },
    })
    if (!competition) throw new CrudHttpError(404, { error: 'Competition not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: competition,
      identifiers: {
        id: String(competition.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: competitionCrudEvents,
      indexer: competitionCrudIndexer,
    })

    return competition
  },
  captureAfter: (_input, result) => serializeCompetition(result),
  buildLog: async ({ result, snapshots }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as SerializedCompetition | undefined
    const after = serializeCompetition(result)
    const changes = buildChanges(
      before ?? null,
      after as unknown as Record<string, unknown>,
      ['name', 'slug', 'stage', 'location', 'startsAt', 'endsAt'],
    )
    return {
      actionLabel: translate('competitions.audit.competition.update', 'Update competition'),
      resourceKind: 'competitions.competition',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      changes,
      snapshotBefore: before ?? null,
      snapshotAfter: after,
    }
  },
  async undo({ logEntry, ctx }) {
    const payload = (logEntry?.commandPayload as { undo?: { before?: SerializedCompetition; after?: SerializedCompetition } } | undefined)?.undo
    const before = (logEntry.snapshotBefore as SerializedCompetition | undefined) ?? payload?.before
    if (!before?.id) throw new Error('Missing previous snapshot for undo')
    const scope = resolveUndoScope(ctx, before)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const updated = await de.updateOrmEntity({
      entity: Competition,
      where: {
        id: before.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<Competition>,
      apply: (entity) => {
        entity.name = before.name
        entity.slug = before.slug
        entity.stage = (before.stage as CompetitionStage) ?? CompetitionStage.DRAFT
        entity.location = before.location
        entity.startsAt = before.startsAt ? new Date(before.startsAt) : entity.startsAt
        entity.endsAt = before.endsAt ? new Date(before.endsAt) : entity.endsAt
        entity.tenantId = before.tenantId ?? scope.tenantId
        entity.organizationId = before.organizationId ?? scope.organizationId
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
      events: competitionCrudEvents,
      indexer: competitionCrudIndexer,
    })
  },
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

const deleteCompetitionCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, Competition> = {
  id: 'competitions.competition.delete',
  isUndoable: true,
  async prepare(input, ctx) {
    const id = requireId(input, 'Competition id required')
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(Competition, { id, deletedAt: null } as FilterQuery<Competition>)
    if (!existing) return {}
    return { before: serializeCompetition(existing) }
  },
  async execute(input, ctx) {
    const id = requireId(input, 'Competition id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const competition = await de.deleteOrmEntity({
      entity: Competition,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<Competition>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    if (!competition) throw new CrudHttpError(404, { error: 'Competition not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: competition,
      identifiers: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: competitionCrudEvents,
      indexer: competitionCrudIndexer,
    })

    return competition
  },
  buildLog: async ({ snapshots, input }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as SerializedCompetition | undefined
    const id = requireId(input, 'Competition id required')
    return {
      actionLabel: translate('competitions.audit.competition.delete', 'Delete competition'),
      resourceKind: 'competitions.competition',
      resourceId: id,
      tenantId: before?.tenantId ?? null,
      organizationId: before?.organizationId ?? null,
      snapshotBefore: before ?? null,
    }
  },
  async undo({ logEntry, ctx }) {
    const before = logEntry.snapshotBefore as SerializedCompetition | undefined
    if (!before?.id) throw new Error('Missing snapshot for undo')
    const scope = resolveUndoScope(ctx, before)
    const em = ctx.container.resolve('em') as EntityManager
    const de = ctx.container.resolve('dataEngine') as DataEngine

    let restored = await em.findOne(Competition, {
      id: before.id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<Competition>)

    if (restored) {
      restored.deletedAt = null
      restored.name = before.name
      restored.slug = before.slug
      restored.stage = (before.stage as CompetitionStage) ?? CompetitionStage.DRAFT
      restored.location = before.location
      restored.tenantId = before.tenantId ?? scope.tenantId
      restored.organizationId = before.organizationId ?? scope.organizationId
      await em.persistAndFlush(restored)
    } else {
      restored = await de.createOrmEntity({
        entity: Competition,
        data: {
          id: before.id,
          name: before.name,
          slug: before.slug,
          stage: (before.stage as CompetitionStage) ?? CompetitionStage.DRAFT,
          location: before.location,
          startsAt: before.startsAt ? new Date(before.startsAt) : new Date(),
          endsAt: before.endsAt ? new Date(before.endsAt) : new Date(),
          tenantId: before.tenantId ?? scope.tenantId,
          organizationId: before.organizationId ?? scope.organizationId,
        },
      })
    }

    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: restored,
      identifiers: {
        id: before.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: competitionCrudEvents,
      indexer: competitionCrudIndexer,
    })
  },
}

// ---------------------------------------------------------------------------
// Register commands
// ---------------------------------------------------------------------------

registerCommand(createCompetitionCommand)
registerCommand(updateCompetitionCommand)
registerCommand(deleteCompetitionCommand)

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

function serializeCompetition(comp: Competition): SerializedCompetition {
  return {
    id: String(comp.id),
    name: String(comp.name),
    slug: String(comp.slug),
    stage: String(comp.stage),
    location: comp.location ? String(comp.location) : null,
    startsAt: comp.startsAt ? comp.startsAt.toISOString() : null,
    endsAt: comp.endsAt ? comp.endsAt.toISOString() : null,
    tenantId: comp.tenantId ? String(comp.tenantId) : null,
    organizationId: comp.organizationId ? String(comp.organizationId) : null,
  }
}

function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}
