import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { Project, ProjectStatus } from '../data/entities'

export const metadata = {
  event: 'competitions.competition.stage_advanced',
  persistent: true,
  id: 'projects:publish-draft-projects',
}

export default async function handler(
  payload: { competitionId: string; oldStage: string; newStage: string; tenantId: string; organizationId: string },
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

  const now = new Date()
  const publishedIds: string[] = []

  for (const project of draftProjects) {
    project.status = ProjectStatus.PUBLISHED
    project.submittedAt = now
    project.updatedAt = now
    publishedIds.push(project.id)
  }

  if (publishedIds.length > 0) {
    await em.persistAndFlush(draftProjects)
    console.log(`[projects:publish-draft-projects] Auto-published ${publishedIds.length} draft projects for competition ${payload.competitionId}`)

    // Emit batch event so judging module can generate demo queue
    try {
      const eventBus = ctx.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
      await eventBus.emit('projects.batch.auto_published', {
        projectIds: publishedIds,
        competitionId: payload.competitionId,
        tenantId: payload.tenantId,
        organizationId: payload.organizationId,
      })
    } catch (e) {
      console.error('[projects:publish-draft-projects] Event emit error:', e)
    }
  } else {
    console.log(`[projects:publish-draft-projects] No draft projects to publish for competition ${payload.competitionId}`)

    // Still emit the event so demo queue generation can proceed with already-published projects
    try {
      const eventBus = ctx.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
      await eventBus.emit('projects.batch.auto_published', {
        projectIds: [],
        competitionId: payload.competitionId,
        tenantId: payload.tenantId,
        organizationId: payload.organizationId,
      })
    } catch (e) {
      console.error('[projects:publish-draft-projects] Event emit error:', e)
    }
  }
}
