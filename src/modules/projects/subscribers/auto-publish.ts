/**
 * Auto-publish projects subscriber.
 *
 * When the competition stage advances to DEMOS, this subscriber auto-publishes
 * all remaining DRAFT projects so they are visible for judging and demos.
 */

export const metadata = {
  event: 'competitions.competition.stage_advanced',
  sync: false,
  priority: 200,
  id: 'projects:auto-publish-on-demos',
}

interface StageAdvancedPayload {
  competitionId: string
  oldStage: string
  newStage: string
  tenantId: string
  organizationId: string
}

export default async function handler(
  payload: StageAdvancedPayload,
): Promise<void> {
  if (payload.newStage !== 'DEMOS') return

  try {
    const { createRequestContainer } = await import('@open-mercato/shared/lib/di/container')
    const container = await createRequestContainer()
    const em = container.resolve('em') as import('@mikro-orm/postgresql').EntityManager
    const knex = em.getKnex()

    // Find all DRAFT projects for this competition
    const draftProjects = await knex('projects_project')
      .where({
        competition_id: payload.competitionId,
        status: 'DRAFT',
        is_active: true,
      })
      .select('id')

    if (draftProjects.length === 0) {
      console.info('[projects] No draft projects to auto-publish', {
        competitionId: payload.competitionId,
      })
      return
    }

    const projectIds = draftProjects.map((p: { id: string }) => p.id)

    // Bulk update to PUBLISHED
    await knex('projects_project')
      .whereIn('id', projectIds)
      .update({
        status: 'PUBLISHED',
        submitted_at: new Date(),
        updated_at: new Date(),
      })

    console.info('[projects] Auto-published draft projects', {
      competitionId: payload.competitionId,
      count: projectIds.length,
    })

    // Emit batch event
    try {
      const { emitProjectsEvent } = await import('../events')
      await emitProjectsEvent('projects.batch.auto_published', {
        competitionId: payload.competitionId,
        projectIds,
        count: projectIds.length,
        tenantId: payload.tenantId,
        organizationId: payload.organizationId,
      })
    } catch {
      // non-critical
    }
  } catch (err) {
    console.warn('[projects] Failed to auto-publish projects', {
      competitionId: payload.competitionId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
