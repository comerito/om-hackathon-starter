import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Competition, CompetitionStage, STAGE_ORDER } from '../data/entities'
import {
  createCompetitionSchema,
  updateCompetitionSchema,
  stageConfigSchema,
  demoConfigSchema,
  judgingConfigSchema,
  peerVotingConfigSchema,
} from '../data/validators'

const ENTITY_ID = 'competitions:competition'

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
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<Competition>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<Competition>) => ({
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

const createCompetitionCommand: CommandHandler<Record<string, unknown>, Competition> = {
  id: 'competitions.competitions.create',
  async execute(rawInput, ctx) {
    const parsed = createCompetitionSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const competition = await de.createOrmEntity({
      entity: Competition,
      data: {
        name: parsed.name,
        slug: parsed.slug,
        description: parsed.description ?? null,
        location: parsed.location ?? null,
        startsAt: new Date(parsed.starts_at),
        endsAt: new Date(parsed.ends_at),
        timezone: parsed.timezone,
        minTeamSize: parsed.min_team_size,
        maxTeamSize: parsed.max_team_size,
        maxTeamsPerTrack: parsed.max_teams_per_track ?? null,
        allowTrackChange: parsed.allow_track_change,
        projectSubmissionDeadline: parsed.project_submission_deadline ? new Date(parsed.project_submission_deadline) : null,
        judgingDeadline: parsed.judging_deadline ? new Date(parsed.judging_deadline) : null,
        stageConfig: parsed.stage_config ?? undefined,
        demoConfig: parsed.demo_config ?? undefined,
        judgingConfig: parsed.judging_config ?? undefined,
        peerVotingConfig: parsed.peer_voting_config ?? undefined,
        codeOfConductUrl: parsed.code_of_conduct_url,
        rulesUrl: parsed.rules_url ?? null,
        privacyPolicyUrl: parsed.privacy_policy_url ?? null,
        coverImageUrl: parsed.cover_image_url ?? null,
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
}

const updateCompetitionCommand: CommandHandler<Record<string, unknown>, Competition> = {
  id: 'competitions.competitions.update',
  async execute(rawInput, ctx) {
    const parsed = updateCompetitionSchema.parse(rawInput)
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
        if (parsed.starts_at !== undefined) entity.startsAt = new Date(parsed.starts_at)
        if (parsed.ends_at !== undefined) entity.endsAt = new Date(parsed.ends_at)
        if (parsed.timezone !== undefined) entity.timezone = parsed.timezone
        if (parsed.min_team_size !== undefined) entity.minTeamSize = parsed.min_team_size
        if (parsed.max_team_size !== undefined) entity.maxTeamSize = parsed.max_team_size
        if (parsed.max_teams_per_track !== undefined) entity.maxTeamsPerTrack = parsed.max_teams_per_track
        if (parsed.allow_track_change !== undefined) entity.allowTrackChange = parsed.allow_track_change
        if (parsed.project_submission_deadline !== undefined) entity.projectSubmissionDeadline = parsed.project_submission_deadline ? new Date(parsed.project_submission_deadline) : null
        if (parsed.judging_deadline !== undefined) entity.judgingDeadline = parsed.judging_deadline ? new Date(parsed.judging_deadline) : null
        if (parsed.stage_config !== undefined) entity.stageConfig = parsed.stage_config
        if (parsed.demo_config !== undefined) entity.demoConfig = parsed.demo_config
        if (parsed.judging_config !== undefined) entity.judgingConfig = parsed.judging_config
        if (parsed.peer_voting_config !== undefined) entity.peerVotingConfig = parsed.peer_voting_config
        if (parsed.code_of_conduct_url !== undefined) entity.codeOfConductUrl = parsed.code_of_conduct_url
        if (parsed.rules_url !== undefined) entity.rulesUrl = parsed.rules_url
        if (parsed.privacy_policy_url !== undefined) entity.privacyPolicyUrl = parsed.privacy_policy_url
        if (parsed.cover_image_url !== undefined) entity.coverImageUrl = parsed.cover_image_url
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
}

const deleteCompetitionCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, Competition> = {
  id: 'competitions.competitions.delete',
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
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: competitionCrudEvents,
      indexer: competitionCrudIndexer,
    })

    return competition
  },
}

// ── Stage Advance Command ───────────────────────────────────────────

const advanceStageCommand: CommandHandler<Record<string, unknown>, Competition> = {
  id: 'competitions.competitions.advance_stage',
  async execute(rawInput, ctx) {
    const { target_stage } = z.object({ target_stage: z.string() }).parse(rawInput)
    const id = (rawInput as Record<string, unknown>).competition_id as string
    if (!id) throw new CrudHttpError(400, { error: 'competition_id is required' })

    const scope = ensureScope(ctx)
    const em = ctx.container.resolve('em') as EntityManager
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const competition = await em.findOne(Competition, {
      id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<Competition>)
    if (!competition) throw new CrudHttpError(404, { error: 'Competition not found' })

    const currentIdx = STAGE_ORDER.indexOf(competition.stage)
    const targetIdx = STAGE_ORDER.indexOf(target_stage as typeof STAGE_ORDER[number])
    if (targetIdx < 0) throw new CrudHttpError(400, { error: `Invalid target stage: ${target_stage}` })
    if (targetIdx <= currentIdx) throw new CrudHttpError(400, { error: `Cannot go back from ${competition.stage} to ${target_stage}` })

    const oldStage = competition.stage
    competition.stage = target_stage as typeof STAGE_ORDER[number]
    await em.persistAndFlush(competition)

    // Emit stage_advanced event for subscribers
    const eventBus = ctx.container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
    await eventBus.emit('competitions.competition.stage_advanced', {
      competitionId: competition.id,
      oldStage,
      newStage: target_stage,
      advancedBy: ctx.auth?.userId ?? ctx.auth?.sub ?? null,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })

    return competition
  },
}

registerCommand(createCompetitionCommand)
registerCommand(updateCompetitionCommand)
registerCommand(deleteCompetitionCommand)
registerCommand(advanceStageCommand)
