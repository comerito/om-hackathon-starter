import { NextResponse } from 'next/server'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { PeerVote } from '../../data/entities'
import { Project } from '../../../projects/data/entities'
import { Team } from '../../../teams/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['sponsors.view'] },
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    const where: Record<string, unknown> = { tenantId: auth.tenantId, organizationId: auth.orgId }
    if (competitionId) where.competitionId = competitionId

    const votes = await em.find(PeerVote, where as FilterQuery<PeerVote>)

    // Tally: count votes per project
    const tally = new Map<string, number>()
    for (const v of votes) {
      tally.set(v.projectId, (tally.get(v.projectId) ?? 0) + 1)
    }

    // Resolve project titles and team names so admins don't have to read raw ids
    const projectIds = Array.from(tally.keys())
    const projects = projectIds.length
      ? await em.find(Project, { id: { $in: projectIds }, tenantId: auth.tenantId } as FilterQuery<Project>)
      : []
    const projectMap = new Map(projects.map(p => [p.id, p]))
    const teamIds = [...new Set(projects.map(p => p.teamId))]
    const teams = teamIds.length
      ? await em.find(Team, { id: { $in: teamIds }, tenantId: auth.tenantId } as FilterQuery<Team>)
      : []
    const teamMap = new Map(teams.map(t => [t.id, t]))

    return NextResponse.json({
      items: Array.from(tally.entries())
        .map(([projectId, count]) => {
          const project = projectMap.get(projectId)
          return {
            project_id: projectId,
            project_title: project?.title ?? null,
            team_id: project?.teamId ?? null,
            team_name: project ? (teamMap.get(project.teamId)?.name ?? null) : null,
            vote_count: count,
          }
        })
        .sort((a, b) => b.vote_count - a.vote_count),
      total_votes: votes.length,
    })
  } catch (error) {
    console.error('[sponsors/votes] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Sponsors', summary: 'Vote tally (admin)',
  methods: { GET: { summary: 'Get vote tally per project' } },
}
