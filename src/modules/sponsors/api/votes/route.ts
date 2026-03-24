import { NextResponse } from 'next/server'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { PeerVote } from '../../data/entities'
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

    return NextResponse.json({
      items: Array.from(tally.entries())
        .map(([projectId, count]) => ({ project_id: projectId, vote_count: count }))
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
