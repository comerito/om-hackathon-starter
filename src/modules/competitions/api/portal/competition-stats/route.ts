import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = { GET: { requireCustomerAuth: true } }

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    if (!competitionId) return NextResponse.json({ error: 'competition_id is required' }, { status: 400 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const knex = (em as any).getConnection().getKnex()

    // Participant count
    const [{ count: participantCount }] = await knex('competitions_participation')
      .where({ competition_id: competitionId, tenant_id: auth.tenantId, deleted_at: null })
      .count('* as count')

    // Track count
    const [{ count: trackCount }] = await knex('tracks_track')
      .where({ competition_id: competitionId, tenant_id: auth.tenantId, deleted_at: null })
      .count('* as count')

    // Team count
    const [{ count: teamCount }] = await knex('teams_team')
      .where({ competition_id: competitionId, tenant_id: auth.tenantId, deleted_at: null })
      .count('* as count')

    // Submission count
    const [{ count: submissionCount }] = await knex('projects_project')
      .where({ competition_id: competitionId, tenant_id: auth.tenantId, status: 'published', deleted_at: null })
      .count('* as count')

    // Avg score (from judging scores if exists — use try/catch)
    let avgScore = 0
    try {
      const [row] = await knex('judging_score')
        .where({ competition_id: competitionId, tenant_id: auth.tenantId })
        .avg('total_score as avg')
      avgScore = row?.avg ? parseFloat(row.avg) : 0
    } catch { /* table may not exist yet */ }

    // Peer vote count
    let totalPeerVotes = 0
    try {
      const [row] = await knex('sponsors_vote')
        .where({ competition_id: competitionId, tenant_id: auth.tenantId })
        .count('* as count')
      totalPeerVotes = parseInt(row?.count ?? '0', 10)
    } catch { /* table may not exist yet */ }

    // Milestone count
    const [{ count: milestoneCount }] = await knex('competitions_milestone')
      .where({ competition_id: competitionId, tenant_id: auth.tenantId })
      .count('* as count')

    return NextResponse.json({
      participant_count: parseInt(String(participantCount), 10),
      track_count: parseInt(String(trackCount), 10),
      team_count: parseInt(String(teamCount), 10),
      submission_count: parseInt(String(submissionCount), 10),
      avg_score: Math.round(avgScore * 10) / 10,
      total_peer_votes: totalPeerVotes,
      milestone_count: parseInt(String(milestoneCount), 10),
    })
  } catch (error) {
    console.error('[portal/competition-stats] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Competition statistics',
  methods: { GET: { summary: 'Get aggregated stats for a competition (portal)' } },
}
