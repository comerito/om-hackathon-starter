import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { emitCrudSideEffects, requireId } from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEmitContext, CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { FilterQuery } from '@mikro-orm/postgresql'
import { Project, ProjectStatus } from '../data/entities'
import { createProjectSchema, updateProjectSchema, flagProjectSchema } from '../data/validators'

const ENTITY_ID = 'projects:project'

export const projectCrudEvents: CrudEventsConfig<Project> = {
  module: 'projects',
  entity: 'project',
  persistent: true,
  buildPayload: (ctx: CrudEmitContext<Project>) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

export const projectCrudIndexer: CrudIndexerConfig<Project> = {
  entityType: ENTITY_ID,
  buildUpsertPayload: (ctx: CrudEmitContext<Project>) => ({
    entityType: ENTITY_ID,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<Project>) => ({
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

const createProjectCommand: CommandHandler<Record<string, unknown>, Project> = {
  id: 'projects.projects.create',
  async execute(rawInput, ctx) {
    const parsed = createProjectSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const project = await de.createOrmEntity({
      entity: Project,
      data: {
        teamId: parsed.team_id,
        competitionId: parsed.competition_id,
        trackId: parsed.track_id,
        title: parsed.title,
        tagline: parsed.tagline ?? null,
        description: parsed.description ?? null,
        problemStatement: parsed.problem_statement ?? null,
        solution: parsed.solution ?? null,
        techStack: parsed.tech_stack,
        demoUrl: parsed.demo_url || null,
        repoUrl: parsed.repo_url || null,
        videoUrl: parsed.video_url || null,
        presentationUrl: parsed.presentation_url || null,
        screenshotIds: parsed.screenshot_ids,
        attachmentIds: parsed.attachment_ids,
        usesPreexistingCode: parsed.uses_preexisting_code,
        preexistingCodeDescription: parsed.preexisting_code_description ?? null,
        builtDuringHackathonDescription: parsed.built_during_hackathon_description ?? null,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
    })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'created',
      entity: project,
      identifiers: {
        id: String(project.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: projectCrudEvents,
      indexer: projectCrudIndexer,
    })

    return project
  },
}

const updateProjectCommand: CommandHandler<Record<string, unknown>, Project> = {
  id: 'projects.projects.update',
  async execute(rawInput, ctx) {
    const parsed = updateProjectSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const project = await de.updateOrmEntity({
      entity: Project,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<Project>,
      apply: (entity) => {
        if (parsed.title !== undefined) entity.title = parsed.title
        if (parsed.tagline !== undefined) entity.tagline = parsed.tagline
        if (parsed.description !== undefined) entity.description = parsed.description
        if (parsed.problem_statement !== undefined) entity.problemStatement = parsed.problem_statement
        if (parsed.solution !== undefined) entity.solution = parsed.solution
        if (parsed.tech_stack !== undefined) entity.techStack = parsed.tech_stack
        if (parsed.demo_url !== undefined) entity.demoUrl = parsed.demo_url || null
        if (parsed.repo_url !== undefined) entity.repoUrl = parsed.repo_url || null
        if (parsed.video_url !== undefined) entity.videoUrl = parsed.video_url || null
        if (parsed.presentation_url !== undefined) entity.presentationUrl = parsed.presentation_url || null
        if (parsed.screenshot_ids !== undefined) entity.screenshotIds = parsed.screenshot_ids
        if (parsed.attachment_ids !== undefined) entity.attachmentIds = parsed.attachment_ids
        if (parsed.uses_preexisting_code !== undefined) entity.usesPreexistingCode = parsed.uses_preexisting_code
        if (parsed.preexisting_code_description !== undefined) entity.preexistingCodeDescription = parsed.preexisting_code_description
        if (parsed.built_during_hackathon_description !== undefined) entity.builtDuringHackathonDescription = parsed.built_during_hackathon_description
      },
    })
    if (!project) throw new CrudHttpError(404, { error: 'Project not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: project,
      identifiers: {
        id: String(project.id),
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: projectCrudEvents,
      indexer: projectCrudIndexer,
    })

    return project
  },
}

const deleteProjectCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, Project> = {
  id: 'projects.projects.delete',
  async execute(input, ctx) {
    const id = requireId(input, 'Project id required')
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const project = await de.deleteOrmEntity({
      entity: Project,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<Project>,
      soft: true,
      softDeleteField: 'deletedAt',
    })
    if (!project) throw new CrudHttpError(404, { error: 'Project not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: project,
      identifiers: { id, tenantId: scope.tenantId, organizationId: scope.organizationId },
      events: projectCrudEvents,
      indexer: projectCrudIndexer,
    })

    return project
  },
}

// ── Flag/Unflag Commands ──────────────────────────────────────────

const flagProjectCommand: CommandHandler<Record<string, unknown>, Project> = {
  id: 'projects.projects.flag',
  async execute(rawInput, ctx) {
    const parsed = flagProjectSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const project = await de.updateOrmEntity({
      entity: Project,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<Project>,
      apply: (entity) => {
        entity.flaggedForReuse = true
        entity.flaggedBy = ctx.auth?.userId ?? ctx.auth?.sub ?? null
        entity.flaggedAt = new Date()
        entity.flaggedReason = parsed.flagged_reason
      },
    })
    if (!project) throw new CrudHttpError(404, { error: 'Project not found' })

    const eventBus = ctx.container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
    await eventBus.emit('projects.project.flagged', {
      projectId: project.id,
      teamId: project.teamId,
      competitionId: project.competitionId,
      flaggedBy: ctx.auth?.userId ?? ctx.auth?.sub ?? null,
      reason: parsed.flagged_reason,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })

    return project
  },
}

const unflagProjectCommand: CommandHandler<Record<string, unknown>, Project> = {
  id: 'projects.projects.unflag',
  async execute(rawInput, ctx) {
    const { id } = rawInput as { id: string }
    if (!id) throw new CrudHttpError(400, { error: 'Project id required' })
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const project = await de.updateOrmEntity({
      entity: Project,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        deletedAt: null,
      } as FilterQuery<Project>,
      apply: (entity) => {
        entity.flaggedForReuse = false
        entity.flaggedBy = null
        entity.flaggedAt = null
        entity.flaggedReason = null
      },
    })
    if (!project) throw new CrudHttpError(404, { error: 'Project not found' })

    return project
  },
}

registerCommand(createProjectCommand)
registerCommand(updateProjectCommand)
registerCommand(deleteProjectCommand)
registerCommand(flagProjectCommand)
registerCommand(unflagProjectCommand)
