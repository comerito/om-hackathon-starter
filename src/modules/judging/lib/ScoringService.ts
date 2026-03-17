import type { EntityManager } from '@mikro-orm/postgresql'

interface CriterionScoreRow {
  score: number
  weight: number
  max_score: number
}

interface LeaderboardEntry {
  projectId: string
  teamId: string
  trackId: string
  title: string
  avgScore: number
  scoreCount: number
  rank: number
}

export class ScoringService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Compute the weighted total score for a ProjectScore and persist it.
   * Formula: sum( (score / maxScore) * weight ) across all criteria
   * This gives a normalized 0-1 score that can be compared across different criteria scales.
   */
  async computeProjectScore(projectScoreId: string): Promise<number | null> {
    const knex = this.em.getKnex()

    const rows: CriterionScoreRow[] = await knex('judging_criterion_score as cs')
      .join('judging_criterion as c', 'c.id', 'cs.criterion_id')
      .where('cs.project_score_id', projectScoreId)
      .whereNull('c.deleted_at')
      .select(
        'cs.score as score',
        'c.weight as weight',
        'c.max_score as max_score',
      )

    if (rows.length === 0) return null

    let totalScore = 0
    for (const row of rows) {
      const maxScore = Number(row.max_score) || 10
      const normalized = Number(row.score) / maxScore
      totalScore += normalized * Number(row.weight)
    }

    // Scale to 0-100 for readability
    const finalScore = Math.round(totalScore * 10000) / 100

    await knex('judging_project_score')
      .where('id', projectScoreId)
      .update({
        total_score: finalScore,
        updated_at: new Date(),
      })

    return finalScore
  }

  /**
   * Compute leaderboard for a competition, optionally filtered by track and round.
   * Returns projects ranked by average score across all judges.
   * Excludes projects from disqualified teams.
   */
  async computeLeaderboard(
    competitionId: string,
    trackId?: string,
    round?: string,
  ): Promise<LeaderboardEntry[]> {
    const knex = this.em.getKnex()

    let query = knex('judging_project_score as ps')
      .join('projects_project as p', 'p.id', 'ps.project_id')
      .join('teams_team as t', 't.id', 'p.team_id')
      .where('ps.competition_id', competitionId)
      .where('ps.is_submitted', true)
      .where('ps.conflict_of_interest', false)
      .where('t.status', 'ACTIVE')
      .whereNull('t.deleted_at')
      .whereNotNull('ps.total_score')
      .groupBy('p.id', 'p.team_id', 'p.track_id', 'p.title')
      .select(
        'p.id as project_id',
        'p.team_id as team_id',
        'p.track_id as track_id',
        'p.title as title',
        knex.raw('avg(ps.total_score) as avg_score'),
        knex.raw('count(ps.id)::int as score_count'),
      )
      .orderBy('avg_score', 'desc')

    if (trackId) {
      query = query.where('p.track_id', trackId)
    }

    if (round) {
      query = query.where('ps.round', round)
    }

    const rows = await query

    return rows.map((row: Record<string, unknown>, idx: number) => ({
      projectId: String(row.project_id),
      teamId: String(row.team_id),
      trackId: String(row.track_id),
      title: String(row.title),
      avgScore: Math.round(Number(row.avg_score) * 100) / 100,
      scoreCount: Number(row.score_count),
      rank: idx + 1,
    }))
  }

  /**
   * Persist final scores and ranks on the projects_project table.
   * Called when the competition advances to FINISHED stage.
   */
  async persistFinalScores(competitionId: string): Promise<number> {
    const leaderboard = await this.computeLeaderboard(competitionId)
    const knex = this.em.getKnex()
    let updated = 0

    for (const entry of leaderboard) {
      await knex('projects_project')
        .where('id', entry.projectId)
        .update({
          final_score: entry.avgScore,
          rank: entry.rank,
          status: 'SCORED',
          updated_at: new Date(),
        })
      updated++
    }

    return updated
  }
}
