import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { rawAll, rawFirst } from '@/lib/db'

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

    // Participant count
    const [{ count: participantCount }] = await rawAll<{ count: string }>(em,
      `SELECT count(*) AS "count" FROM competitions_participation WHERE competition_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [competitionId, auth.tenantId],
    )

    // Track count
    const [{ count: trackCount }] = await rawAll<{ count: string }>(em,
      `SELECT count(*) AS "count" FROM tracks_track WHERE competition_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [competitionId, auth.tenantId],
    )

    // Team count
    const [{ count: teamCount }] = await rawAll<{ count: string }>(em,
      `SELECT count(*) AS "count" FROM teams_team WHERE competition_id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [competitionId, auth.tenantId],
    )

    // Submission count
    const [{ count: submissionCount }] = await rawAll<{ count: string }>(em,
      `SELECT count(*) AS "count" FROM projects_project WHERE competition_id = ? AND tenant_id = ? AND status = ? AND deleted_at IS NULL`,
      [competitionId, auth.tenantId, 'published'],
    )

    // Avg score (from judging scores if exists — use try/catch)
    let avgScore = 0
    try {
      const row = await rawFirst<{ avg: string | null }>(em,
        `SELECT avg(total_score) AS "avg" FROM judging_project_score WHERE competition_id = ? AND tenant_id = ?`,
        [competitionId, auth.tenantId],
      )
      avgScore = row?.avg ? parseFloat(row.avg) : 0
    } catch { /* table may not exist yet */ }

    // Peer vote count
    let totalPeerVotes = 0
    try {
      const row = await rawFirst<{ count: string }>(em,
        `SELECT count(*) AS "count" FROM sponsors_peer_vote WHERE competition_id = ? AND tenant_id = ?`,
        [competitionId, auth.tenantId],
      )
      totalPeerVotes = parseInt(row?.count ?? '0', 10)
    } catch { /* table may not exist yet */ }

    // Milestone count
    const [{ count: milestoneCount }] = await rawAll<{ count: string }>(em,
      `SELECT count(*) AS "count" FROM competitions_milestone WHERE competition_id = ? AND tenant_id = ?`,
      [competitionId, auth.tenantId],
    )

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
