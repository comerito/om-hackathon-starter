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

    // Get leaderboard data with scores
    const rows = await knex('projects_project as p')
      .leftJoin('teams_team as t', function (this: any) {
        this.on('p.team_id', '=', 't.id').andOn('t.tenant_id', '=', 'p.tenant_id')
      })
      .leftJoin(
        knex('judging_project_score')
          .select('project_id')
          .avg('total_score as avg_score')
          .where({ is_submitted: true })
          .groupBy('project_id')
          .as('s'),
        's.project_id',
        'p.id',
      )
      .select(
        'p.title',
        't.name as team_name',
        'p.status',
        'p.rank',
        's.avg_score',
        'p.peer_vote_count',
        't.is_finalist',
      )
      .where({ 'p.competition_id': competitionId, 'p.tenant_id': auth.tenantId })
      .whereNull('p.deleted_at')
      .whereNot('p.status', 'draft')
      .orderByRaw('COALESCE(p.rank, 9999) ASC, COALESCE(s.avg_score, 0) DESC')

    // Build CSV
    const header = 'Rank,Project,Team,Avg Score,Peer Votes,Status,Finalist\n'
    const csvRows = rows.map((row: any, i: number) => {
      const rank = row.rank ?? i + 1
      const title = (row.title || '').replace(/"/g, '""')
      const teamName = (row.team_name || '').replace(/"/g, '""')
      const avgScore = row.avg_score != null ? Number(row.avg_score).toFixed(2) : ''
      const peerVotes = row.peer_vote_count ?? 0
      const status = row.status || ''
      const finalist = row.is_finalist ? 'Yes' : 'No'
      return `${rank},"${title}","${teamName}",${avgScore},${peerVotes},"${status}","${finalist}"`
    }).join('\n')

    return new Response(header + csvRows, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="results-${competitionId.slice(0, 8)}.csv"`,
      },
    })
  } catch (error) {
    console.error('[portal/export-results] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Export results as CSV',
  methods: { GET: { summary: 'Export competition results as CSV (portal)' } },
}
