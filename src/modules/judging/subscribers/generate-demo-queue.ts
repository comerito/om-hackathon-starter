import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { DemoSession, DemoStatus, JudgingRound } from '../data/entities'
import { Project, ProjectStatus } from '../../projects/data/entities'

export const metadata = {
  event: 'projects.batch.auto_published',
  persistent: true,
  id: 'judging:generate-demo-queue',
}

export default async function handler(
  payload: { projectIds: string[]; competitionId: string; tenantId: string; organizationId: string },
  ctx: { resolve: <T = unknown>(name: string) => T },
) {
  const em = ctx.resolve('em') as EntityManager

  // Find all published projects for this competition (not just the newly published ones)
  const projects = await em.find(Project, {
    competitionId: payload.competitionId,
    status: ProjectStatus.PUBLISHED,
    deletedAt: null,
    tenantId: payload.tenantId,
  } as FilterQuery<Project>, { orderBy: { trackId: 'ASC', createdAt: 'ASC' } })

  let order = 0
  let created = 0

  for (const project of projects) {
    // Idempotency: skip if session already exists
    const existing = await em.findOne(DemoSession, {
      projectId: project.id,
      competitionId: payload.competitionId,
      round: JudgingRound.PRELIMINARY,
    } as FilterQuery<DemoSession>)
    if (existing) {
      order = Math.max(order, existing.presentationOrder + 1)
      continue
    }

    const now = new Date()
    const session = em.create(DemoSession, {
      competitionId: payload.competitionId,
      teamId: project.teamId,
      projectId: project.id,
      trackId: project.trackId,
      presentationOrder: order++,
      presentationDurationMinutes: 3,
      qaDurationMinutes: 2,
      status: DemoStatus.QUEUED,
      round: JudgingRound.PRELIMINARY,
      tenantId: payload.tenantId,
      organizationId: payload.organizationId,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(session)
    created++
  }

  if (created > 0) {
    await em.flush()
    console.log(`[judging:generate-demo-queue] Created ${created} demo sessions for competition ${payload.competitionId}`)
  } else {
    console.log(`[judging:generate-demo-queue] No new demo sessions needed for competition ${payload.competitionId}`)
  }
}
