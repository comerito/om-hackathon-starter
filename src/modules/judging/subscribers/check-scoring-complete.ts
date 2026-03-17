/**
 * Check scoring complete subscriber.
 *
 * When a judge submits a score, this subscriber checks if all judges
 * have scored the project. If so, it marks the project as SCORED.
 */

export const metadata = {
  event: 'judging.score.submitted',
  sync: false,
  priority: 100,
  id: 'judging:check-scoring-complete',
}

interface ScoreSubmittedPayload {
  projectScoreId: string
  projectId: string
  judgeId: string
  round: string
  competitionId: string
  totalScore: number | null
  tenantId: string
  organizationId: string
}

export default async function handler(
  payload: ScoreSubmittedPayload,
): Promise<void> {
  try {
    const { createRequestContainer } = await import('@open-mercato/shared/lib/di/container')
    const container = await createRequestContainer()
    const em = container.resolve('em') as import('@mikro-orm/postgresql').EntityManager
    const knex = em.getKnex()

    const { projectId, competitionId } = payload

    // Get project's track
    const project = await knex('projects_project')
      .where('id', projectId)
      .select('track_id')
      .first()

    if (!project) return

    // Find all judges assigned to panels that cover this project's track
    const panelJudges = await knex('judging_panel_judge as pj')
      .join('judging_panel as p', 'p.id', 'pj.panel_id')
      .leftJoin('judging_panel_track as pt', 'pt.panel_id', 'p.id')
      .where('p.competition_id', competitionId)
      .whereNull('p.deleted_at')
      .where(function () {
        // Panels with no track assignment cover all tracks
        this.whereNull('pt.track_id').orWhere('pt.track_id', project.track_id)
      })
      .select('pj.judge_id')
      .distinct()

    const expectedJudgeIds = panelJudges.map((j: { judge_id: string }) => j.judge_id)

    if (expectedJudgeIds.length === 0) return

    // Count submitted scores for this project
    const submittedScores = await knex('judging_project_score')
      .where({ project_id: projectId, is_submitted: true, conflict_of_interest: false })
      .whereIn('judge_id', expectedJudgeIds)
      .count('* as count')
      .first()

    const scoredCount = Number(submittedScores?.count ?? 0)

    if (scoredCount >= expectedJudgeIds.length) {
      // All judges have scored — mark project as SCORED
      await knex('projects_project')
        .where('id', projectId)
        .where('status', 'PUBLISHED')
        .update({
          status: 'SCORED',
          updated_at: new Date(),
        })

      console.info('[judging] All judges scored project, marked as SCORED', {
        projectId,
        scoredCount,
        expectedCount: expectedJudgeIds.length,
      })
    }
  } catch (err) {
    console.warn('[judging] Failed to check scoring completeness', {
      projectId: payload.projectId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
