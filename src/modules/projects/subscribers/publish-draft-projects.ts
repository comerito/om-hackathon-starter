import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { Attachment } from '@open-mercato/core/modules/attachments/data/entities'
import { resolveNotificationService } from '@open-mercato/core/modules/notifications/lib/notificationService'
import { Team, TeamMember, TeamRole } from '../../teams/data/entities'
import { Project, ProjectStatus } from '../data/entities'
import { partitionBySubmissionReadiness } from '../lib/submission-validation'

export const metadata = {
  event: 'competitions.competition.stage_advanced',
  persistent: true,
  id: 'projects:publish-draft-projects',
}

type StageAdvancedPayload = {
  competitionId: string
  oldStage: string
  newStage: string
  tenantId: string
  organizationId: string
}

type SkippedProject = {
  projectId: string
  teamId: string
  teamName: string | null
  trackId: string
  reasons: string[]
}

export default async function handler(
  payload: StageAdvancedPayload,
  ctx: { resolve: <T = unknown>(name: string) => T },
) {
  // Only act when entering DEMOS stage
  if (payload.newStage !== 'demos') return

  const em = ctx.resolve('em') as EntityManager

  // Find all DRAFT projects for this competition
  const draftProjects = await em.find(Project, {
    competitionId: payload.competitionId,
    status: ProjectStatus.DRAFT,
    deletedAt: null,
    tenantId: payload.tenantId,
  } as FilterQuery<Project>)

  // ── Read phase ────────────────────────────────────────────────────
  // Every query the decision needs runs BEFORE the first scalar mutation:
  // MikroORM 7 silently drops a pending UPDATE if a find is interleaved with
  // it, so the publish loop below must not touch the EntityManager for reads.

  const attachmentIds = [...new Set(draftProjects.flatMap((project) => project.attachmentIds ?? []).filter(Boolean))]
  const attachmentNamesById = new Map<string, string>()
  if (attachmentIds.length > 0) {
    const attachments = await em.find(Attachment, { id: { $in: attachmentIds } } as FilterQuery<Attachment>)
    for (const attachment of attachments) attachmentNamesById.set(attachment.id, attachment.fileName)
  }

  const teamIds = [...new Set(draftProjects.map((project) => project.teamId))]
  const teamNamesById = new Map<string, string>()
  if (teamIds.length > 0) {
    const teams = await em.find(Team, { id: { $in: teamIds } } as FilterQuery<Team>)
    for (const team of teams) teamNamesById.set(team.id, team.name)
  }

  // Decide, per draft, whether it satisfies the same requirements the team owner
  // would have had to satisfy through "submit project".
  const partition = partitionBySubmissionReadiness(draftProjects, (project) =>
    (project.attachmentIds ?? [])
      .map((id) => attachmentNamesById.get(id))
      .filter((name): name is string => typeof name === 'string'),
  )

  const publishable = partition.ready
  const skipped: SkippedProject[] = partition.incomplete.map(({ project, reasons }) => ({
    projectId: project.id,
    teamId: project.teamId,
    teamName: teamNamesById.get(project.teamId) ?? null,
    trackId: project.trackId,
    reasons,
  }))

  // Team owners to notify about a draft that did NOT make it in. Read here, for
  // the same reason as above — the notification itself is sent after the flush.
  const skippedTeamIds = [...new Set(skipped.map((entry) => entry.teamId))]
  const ownersByTeamId = new Map<string, string[]>()
  if (skippedTeamIds.length > 0) {
    const owners = await em.find(TeamMember, {
      teamId: { $in: skippedTeamIds },
      role: TeamRole.OWNER,
      deletedAt: null,
      tenantId: payload.tenantId,
    } as FilterQuery<TeamMember>)
    for (const owner of owners) {
      const list = ownersByTeamId.get(owner.teamId) ?? []
      list.push(owner.customerUserId)
      ownersByTeamId.set(owner.teamId, list)
    }
  }

  // ── Write phase ───────────────────────────────────────────────────
  const now = new Date()
  const publishedIds: string[] = []
  for (const project of publishable) {
    project.status = ProjectStatus.PUBLISHED
    project.submittedAt = now
    project.updatedAt = now
    publishedIds.push(project.id)
  }

  if (publishedIds.length > 0) {
    em.persist(publishable)
    await em.flush()
  }

  // ── Report ────────────────────────────────────────────────────────
  // Side effects only after the flush has committed.
  console.log(
    `[projects:publish-draft-projects] Competition ${payload.competitionId}: ` +
    `auto-published ${publishedIds.length} of ${draftProjects.length} draft project(s), ` +
    `skipped ${skipped.length} as incomplete`,
  )
  for (const entry of skipped) {
    console.warn(
      `[projects:publish-draft-projects] NOT published — project ${entry.projectId} ` +
      `(team ${entry.teamName ?? entry.teamId}, track ${entry.trackId}): ${entry.reasons.join('; ')}`,
    )
  }

  const eventBus = ctx.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }

  // Always emit, even with zero published projects, so demo-queue generation can
  // proceed with the projects that were submitted properly.
  try {
    await eventBus.emit('projects.batch.auto_published', {
      projectIds: publishedIds,
      skippedProjects: skipped,
      competitionId: payload.competitionId,
      tenantId: payload.tenantId,
      organizationId: payload.organizationId,
    })
  } catch (e) {
    console.error('[projects:publish-draft-projects] Event emit error:', e)
  }

  if (skipped.length === 0) return

  // A dedicated event so an organiser-facing surface can list exactly which teams
  // were left out and why, without having to re-derive it.
  try {
    await eventBus.emit('projects.batch.auto_publish_skipped', {
      competitionId: payload.competitionId,
      skippedProjects: skipped,
      tenantId: payload.tenantId,
      organizationId: payload.organizationId,
    })
  } catch (e) {
    console.error('[projects:publish-draft-projects] Event emit error:', e)
  }

  // Tell each affected team the truth, naming the requirements they missed.
  try {
    const notificationService = resolveNotificationService(ctx)
    for (const entry of skipped) {
      const recipientUserIds = ownersByTeamId.get(entry.teamId) ?? []
      if (recipientUserIds.length === 0) continue
      await notificationService.createBatch(
        {
          recipientUserIds,
          type: 'projects.auto_publish_skipped',
          title: 'Your project was not submitted',
          titleKey: 'projects.notifications.autoPublishSkipped.title',
          body: `The competition moved to Demo Day and "${entry.teamName ?? 'your team'}" was left out because the project is incomplete: ${entry.reasons.join('; ')}.`,
          bodyKey: 'projects.notifications.autoPublishSkipped.body',
          bodyVariables: { reasons: entry.reasons.join('; ') },
          icon: 'alert-triangle',
          severity: 'error',
          sourceModule: 'projects',
          sourceEntityType: 'projects:project',
          sourceEntityId: entry.projectId,
          groupKey: `auto-publish-skipped-${entry.projectId}`,
        },
        { tenantId: payload.tenantId, organizationId: payload.organizationId },
      )
    }
  } catch (e) {
    console.error('[projects:publish-draft-projects] Notification error:', e)
  }
}
