import { NextResponse } from 'next/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { ProjectScore } from '../../data/entities'
import { Project } from '../../../projects/data/entities'
import { Team } from '../../../teams/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['judging.results.view'] },
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    const trackId = url.searchParams.get('track_id')

    if (!competitionId) {
      return NextResponse.json({ error: 'competition_id required' }, { status: 400 })
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Find all projects for this competition/track
    const projectWhere: Record<string, unknown> = {
      competitionId,
      status: { $ne: 'draft' },
      deletedAt: null,
      tenantId: auth.tenantId,
    }
    if (trackId) projectWhere.trackId = trackId

    const projects = await em.find(Project, projectWhere as FilterQuery<Project>)

    // Get all submitted scores for these projects
    const projectIds = projects.map(p => p.id)
    const scores = projectIds.length
      ? await em.find(ProjectScore, {
          projectId: { $in: projectIds },
          isSubmitted: true,
          tenantId: auth.tenantId,
        } as FilterQuery<ProjectScore>)
      : []

    // Compute average score per project
    const scoreMap = new Map<string, number[]>()
    for (const s of scores) {
      if (s.totalScore == null) continue
      const arr = scoreMap.get(s.projectId) ?? []
      arr.push(s.totalScore)
      scoreMap.set(s.projectId, arr)
    }

    // Get team names
    const teamIds = [...new Set(projects.map(p => p.teamId))]
    const teams = teamIds.length ? await em.find(Team, { id: { $in: teamIds }, tenantId: auth.tenantId } as FilterQuery<Team>) : []
    const teamMap = new Map(teams.map(t => [t.id, t]))

    // Build leaderboard entries
    const entries = projects.map(p => {
      const projectScores = scoreMap.get(p.id) ?? []
      const avgScore = projectScores.length > 0
        ? Math.round((projectScores.reduce((a, b) => a + b, 0) / projectScores.length) * 100) / 100
        : null
      const team = teamMap.get(p.teamId)

      return {
        project_id: p.id,
        project_title: p.title,
        team_id: p.teamId,
        team_name: team?.name ?? null,
        team_status: team?.status ?? null,
        track_id: p.trackId,
        average_score: avgScore,
        score_count: projectScores.length,
        final_score: p.finalScore,
        rank: p.rank,
        manual_rank_override: p.manualRankOverride,
        peer_vote_count: p.peerVoteCount,
        is_finalist: team?.isFinalist ?? false,
      }
    })

    // Sort by rank (if set), then by average_score desc
    entries.sort((a, b) => {
      if (a.team_status === 'disqualified' && b.team_status !== 'disqualified') return 1
      if (b.team_status === 'disqualified' && a.team_status !== 'disqualified') return -1
      const rankA = a.manual_rank_override ?? a.rank ?? 999
      const rankB = b.manual_rank_override ?? b.rank ?? 999
      if (rankA !== rankB) return rankA - rankB
      return (b.average_score ?? 0) - (a.average_score ?? 0)
    })

    return NextResponse.json({ items: entries, total: entries.length })
  } catch (error) {
    console.error('[judging/leaderboard] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Judging', summary: 'Leaderboard',
  methods: { GET: { summary: 'Get leaderboard per track' } },
}
