import { rawAll } from '../../../../../lib/db'
import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { applyPortalTranslationOverlays, resolvePortalLocale } from '@/lib/portal-translations'

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
    const locale = await resolvePortalLocale(req, { auth, container })

    // Get leaderboard data with scores
    const rows = await rawAll<any>(em, `
      SELECT p.id as id, p.title, t.name as team_name, p.status, p.rank,
             s.avg_score, p.peer_vote_count, t.is_finalist
      FROM projects_project p
      LEFT JOIN teams_team t ON t.id = p.team_id AND t.tenant_id = p.tenant_id
      LEFT JOIN (
        SELECT project_id, AVG(total_score) as avg_score
        FROM judging_project_score
        WHERE is_submitted = true
        GROUP BY project_id
      ) s ON s.project_id = p.id
      WHERE p.competition_id = ? AND p.tenant_id = ?
        AND p.deleted_at IS NULL
        AND p.status <> 'draft'
      ORDER BY COALESCE(p.rank, 9999) ASC, COALESCE(s.avg_score, 0) DESC
    `, [competitionId, auth.tenantId])

    const translatedRows = await applyPortalTranslationOverlays(
      rows.map((row: any) => ({
        ...row,
        id: String(row.id),
        title: row.title ?? '',
      })),
      {
        entityType: 'projects:project',
        locale,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
        container,
      },
    )

    // Build CSV
    const header = 'Rank,Project,Team,Avg Score,Peer Votes,Status,Finalist\n'
    const csvRows = translatedRows.map((row: any, i: number) => {
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
