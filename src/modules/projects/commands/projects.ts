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
import { Project } from '../data/entities'
import { createProjectSchema, updateProjectSchema } from '../data/validators'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'

export const projectCreateSchema = createProjectSchema
export const projectUpdateSchema = updateProjectSchema

const ENTITY_TYPE = 'projects:project' as const

type SerializedProject = {
  id: string
  teamId: string
  competitionId: string
  trackId: string
  title: string
  tagline: string | null
  description: string | null
  problemStatement: string | null
  solution: string | null
  techStack: string[]
  demoUrl: string | null
  repoUrl: string | null
  videoUrl: string | null
  presentationUrl: string | null
  screenshotIds: string[]
  attachmentIds: string[]
  usesPreexistingCode: boolean
  preexistingCodeDescription: string | null
  builtDuringHackathonDescription: string | null
  flaggedForReuse: boolean
  status: string
  submittedAt: string | null
  finalScore: number | null
  peerVoteCount: number | null
  rank: number | null
  manualRankOverride: number | null
  isActive: boolean
  tenantId: string | null
  organizationId: string | null
}

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
  entityType: ENTITY_TYPE,
  buildUpsertPayload: (ctx: CrudEmitContext<Project>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx: CrudEmitContext<Project>) => ({
    entityType: ENTITY_TYPE,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const createProjectCommand: CommandHandler<Record<string, unknown>, Project> = {
  id: 'projects.project.create',
  isUndoable: true,
  async execute(rawInput, ctx) {
    const parsed = projectCreateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const project = await de.createOrmEntity({
      entity: Project,
      data: {
        teamId: parsed.teamId,
        competitionId: parsed.competitionId,
        trackId: parsed.trackId,
        title: parsed.title,
        tagline: parsed.tagline ?? null,
        description: parsed.description ?? null,
        isActive: true,
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
  captureAfter: (_input, result) => serializeProject(result),
  buildLog: async ({ result }) => {
    const { translate } = await resolveTranslations()
    return {
      actionLabel: translate('projects.audit.project.create', 'Create project'),
      resourceKind: 'projects.project',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      snapshotAfter: serializeProject(result),
    }
  },
  async undo({ logEntry, ctx }) {
    const payload = (logEntry?.commandPayload as { undo?: { after?: SerializedProject } } | undefined)?.undo
    const snapshot = (logEntry.snapshotAfter as SerializedProject | undefined) ?? payload?.after
    const id = snapshot?.id ?? logEntry.resourceId
    if (!id) throw new Error('Missing project id for undo')
    const scope = resolveUndoScope(ctx, snapshot)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    await de.deleteOrmEntity({
      entity: Project,
      where: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<Project>,
      soft: false,
    })

    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: null as unknown as Project,
      identifiers: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: projectCrudEvents,
      indexer: projectCrudIndexer,
    })
  },
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

const updateProjectCommand: CommandHandler<Record<string, unknown>, Project> = {
  id: 'projects.project.update',
  isUndoable: true,
  async prepare(rawInput, ctx) {
    const parsed = projectUpdateSchema.parse(rawInput)
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(Project, { id: parsed.id } as FilterQuery<Project>)
    if (!existing) throw new CrudHttpError(404, { error: 'Project not found' })
    return { before: serializeProject(existing) }
  },
  async execute(rawInput, ctx) {
    const parsed = projectUpdateSchema.parse(rawInput)
    const scope = ensureScope(ctx)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const project = await de.updateOrmEntity({
      entity: Project,
      where: {
        id: parsed.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<Project>,
      apply: (entity) => {
        if (parsed.title !== undefined) entity.title = parsed.title
        if (parsed.tagline !== undefined) entity.tagline = parsed.tagline
        if (parsed.description !== undefined) entity.description = parsed.description
        if (parsed.problemStatement !== undefined) entity.problemStatement = parsed.problemStatement
        if (parsed.solution !== undefined) entity.solution = parsed.solution
        if (parsed.techStack !== undefined) entity.techStack = parsed.techStack
        if (parsed.demoUrl !== undefined) entity.demoUrl = parsed.demoUrl
        if (parsed.repoUrl !== undefined) entity.repoUrl = parsed.repoUrl
        if (parsed.videoUrl !== undefined) entity.videoUrl = parsed.videoUrl
        if (parsed.presentationUrl !== undefined) entity.presentationUrl = parsed.presentationUrl
        if (parsed.screenshotIds !== undefined) entity.screenshotIds = parsed.screenshotIds
        if (parsed.attachmentIds !== undefined) entity.attachmentIds = parsed.attachmentIds
        if (parsed.usesPreexistingCode !== undefined) entity.usesPreexistingCode = parsed.usesPreexistingCode
        if (parsed.preexistingCodeDescription !== undefined) entity.preexistingCodeDescription = parsed.preexistingCodeDescription
        if (parsed.builtDuringHackathonDescription !== undefined) entity.builtDuringHackathonDescription = parsed.builtDuringHackathonDescription
        if (parsed.trackId !== undefined) entity.trackId = parsed.trackId
        if (parsed.isActive !== undefined) entity.isActive = parsed.isActive
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
  captureAfter: (_input, result) => serializeProject(result),
  buildLog: async ({ result, snapshots }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as SerializedProject | undefined
    const after = serializeProject(result)
    const changes = buildChanges(
      before ?? null,
      after as unknown as Record<string, unknown>,
      ['title', 'tagline', 'description', 'problemStatement', 'solution', 'techStack', 'demoUrl', 'repoUrl', 'videoUrl', 'presentationUrl', 'usesPreexistingCode', 'trackId', 'status'],
    )
    return {
      actionLabel: translate('projects.audit.project.update', 'Update project'),
      resourceKind: 'projects.project',
      resourceId: String(result.id),
      tenantId: result.tenantId ? String(result.tenantId) : null,
      organizationId: result.organizationId ? String(result.organizationId) : null,
      changes,
      snapshotBefore: before ?? null,
      snapshotAfter: after,
    }
  },
  async undo({ logEntry, ctx }) {
    const payload = (logEntry?.commandPayload as { undo?: { before?: SerializedProject; after?: SerializedProject } } | undefined)?.undo
    const before = (logEntry.snapshotBefore as SerializedProject | undefined) ?? payload?.before
    if (!before?.id) throw new Error('Missing previous snapshot for undo')
    const scope = resolveUndoScope(ctx, before)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    const updated = await de.updateOrmEntity({
      entity: Project,
      where: {
        id: before.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      } as FilterQuery<Project>,
      apply: (entity) => {
        entity.title = before.title
        entity.tagline = before.tagline
        entity.description = before.description
        entity.problemStatement = before.problemStatement
        entity.solution = before.solution
        entity.techStack = before.techStack
        entity.demoUrl = before.demoUrl
        entity.repoUrl = before.repoUrl
        entity.videoUrl = before.videoUrl
        entity.presentationUrl = before.presentationUrl
        entity.screenshotIds = before.screenshotIds
        entity.attachmentIds = before.attachmentIds
        entity.usesPreexistingCode = before.usesPreexistingCode
        entity.preexistingCodeDescription = before.preexistingCodeDescription
        entity.builtDuringHackathonDescription = before.builtDuringHackathonDescription
        entity.trackId = before.trackId
        entity.status = before.status as Project['status']
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
      events: projectCrudEvents,
      indexer: projectCrudIndexer,
    })
  },
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

const deleteProjectCommand: CommandHandler<{ body?: Record<string, unknown>; query?: Record<string, unknown> }, Project> = {
  id: 'projects.project.delete',
  isUndoable: true,
  async prepare(input, ctx) {
    const id = requireId(input, 'Project id required')
    const em = ctx.container.resolve('em') as EntityManager
    const existing = await em.findOne(Project, { id } as FilterQuery<Project>)
    if (!existing) return {}
    return { before: serializeProject(existing) }
  },
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
      } as FilterQuery<Project>,
      soft: false,
    })
    if (!project) throw new CrudHttpError(404, { error: 'Project not found' })

    await emitCrudSideEffects({
      dataEngine: de,
      action: 'deleted',
      entity: project,
      identifiers: {
        id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: projectCrudEvents,
      indexer: projectCrudIndexer,
    })

    return project
  },
  buildLog: async ({ snapshots, input }) => {
    const { translate } = await resolveTranslations()
    const before = snapshots.before as SerializedProject | undefined
    const id = requireId(input, 'Project id required')
    return {
      actionLabel: translate('projects.audit.project.delete', 'Delete project'),
      resourceKind: 'projects.project',
      resourceId: id,
      tenantId: before?.tenantId ?? null,
      organizationId: before?.organizationId ?? null,
      snapshotBefore: before ?? null,
    }
  },
  async undo({ logEntry, ctx }) {
    const before = logEntry.snapshotBefore as SerializedProject | undefined
    if (!before?.id) throw new Error('Missing snapshot for undo')
    const scope = resolveUndoScope(ctx, before)
    const de = ctx.container.resolve('dataEngine') as DataEngine

    await de.createOrmEntity({
      entity: Project,
      data: {
        id: before.id,
        teamId: before.teamId,
        competitionId: before.competitionId,
        trackId: before.trackId,
        title: before.title,
        tagline: before.tagline,
        description: before.description,
        problemStatement: before.problemStatement,
        solution: before.solution,
        techStack: before.techStack,
        demoUrl: before.demoUrl,
        repoUrl: before.repoUrl,
        videoUrl: before.videoUrl,
        presentationUrl: before.presentationUrl,
        screenshotIds: before.screenshotIds,
        attachmentIds: before.attachmentIds,
        usesPreexistingCode: before.usesPreexistingCode,
        preexistingCodeDescription: before.preexistingCodeDescription,
        builtDuringHackathonDescription: before.builtDuringHackathonDescription,
        status: before.status as Project['status'],
        isActive: before.isActive,
        tenantId: before.tenantId ?? scope.tenantId,
        organizationId: before.organizationId ?? scope.organizationId,
      },
    })

    await emitCrudUndoSideEffects({
      dataEngine: de,
      action: 'updated',
      entity: null as unknown as Project,
      identifiers: {
        id: before.id,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
      },
      events: projectCrudEvents,
      indexer: projectCrudIndexer,
    })
  },
}

// ---------------------------------------------------------------------------
// Register commands
// ---------------------------------------------------------------------------

registerCommand(createProjectCommand)
registerCommand(updateProjectCommand)
registerCommand(deleteProjectCommand)

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

function serializeProject(project: Project): SerializedProject {
  return {
    id: String(project.id),
    teamId: String(project.teamId),
    competitionId: String(project.competitionId),
    trackId: String(project.trackId),
    title: String(project.title),
    tagline: project.tagline ? String(project.tagline) : null,
    description: project.description ? String(project.description) : null,
    problemStatement: project.problemStatement ? String(project.problemStatement) : null,
    solution: project.solution ? String(project.solution) : null,
    techStack: Array.isArray(project.techStack) ? project.techStack : [],
    demoUrl: project.demoUrl ? String(project.demoUrl) : null,
    repoUrl: project.repoUrl ? String(project.repoUrl) : null,
    videoUrl: project.videoUrl ? String(project.videoUrl) : null,
    presentationUrl: project.presentationUrl ? String(project.presentationUrl) : null,
    screenshotIds: Array.isArray(project.screenshotIds) ? project.screenshotIds : [],
    attachmentIds: Array.isArray(project.attachmentIds) ? project.attachmentIds : [],
    usesPreexistingCode: Boolean(project.usesPreexistingCode),
    preexistingCodeDescription: project.preexistingCodeDescription ? String(project.preexistingCodeDescription) : null,
    builtDuringHackathonDescription: project.builtDuringHackathonDescription ? String(project.builtDuringHackathonDescription) : null,
    flaggedForReuse: Boolean(project.flaggedForReuse),
    status: String(project.status),
    submittedAt: project.submittedAt ? project.submittedAt.toISOString() : null,
    finalScore: project.finalScore ?? null,
    peerVoteCount: project.peerVoteCount ?? null,
    rank: project.rank ?? null,
    manualRankOverride: project.manualRankOverride ?? null,
    isActive: Boolean(project.isActive),
    tenantId: project.tenantId ? String(project.tenantId) : null,
    organizationId: project.organizationId ? String(project.organizationId) : null,
  }
}

function ensureScope(ctx: CommandRuntimeContext): { tenantId: string; organizationId: string } {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}
