/**
 * Close voting subscriber.
 *
 * When the competition advances to DELIBERATION stage, this subscriber
 * closes the voting window by persisting final peer vote counts on all projects.
 */

export const metadata = {
  event: 'competitions.competition.stage_advanced',
  sync: false,
  priority: 200,
  id: 'sponsors:close-voting',
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
  if (payload.newStage !== 'DELIBERATION') return

  try {
    const { createRequestContainer } = await import('@open-mercato/shared/lib/di/container')
    const container = await createRequestContainer()
    const em = container.resolve('em') as import('@mikro-orm/postgresql').EntityManager
    const knex = em.getKnex()

    // Persist final vote counts on all projects in this competition
    const voteCountsQuery = knex('sponsors_peer_vote')
      .where('competition_id', payload.competitionId)
      .groupBy('project_id')
      .select('project_id', knex.raw('count(id)::int as vote_count'))

    const voteCounts = await voteCountsQuery

    let updated = 0
    for (const row of voteCounts) {
      await knex('projects_project')
        .where('id', row.project_id)
        .update({
          peer_vote_count: row.vote_count,
          updated_at: new Date(),
        })
      updated++
    }

    console.info('[sponsors] Closed voting on stage advance to DELIBERATION', {
      competitionId: payload.competitionId,
      projectsUpdated: updated,
    })
  } catch (err) {
    console.warn('[sponsors] Failed to close voting', {
      competitionId: payload.competitionId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
