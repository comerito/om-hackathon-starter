import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { applyPortalTranslationOverlays, resolvePortalLocale } from '@/lib/portal-translations'
import { rawAll } from '@/lib/db'
import { Competition } from '../../../../competitions/data/entities'
import { PORTAL_RESULTS_FEATURE, requirePortalFeatures } from '../../../lib/portalAuth'
import { RESULTS_NOT_PUBLISHED_MESSAGE, areResultsPublished } from '../../../lib/resultsScope'

// NOTE: `requireCustomerAuth` / `requireCustomerFeatures` are NOT enforced for API routes —
// the dispatcher in `src/app/api/[...slug]/route.ts` only reads `requireAuth`,
// `requireRoles`, `requireFeatures` and `rateLimit`. They are kept here as the declaration of
// intent; the enforcement lives in the handler below (`requirePortalFeatures`).
export const metadata = {
  GET: { requireCustomerAuth: true, requireCustomerFeatures: [PORTAL_RESULTS_FEATURE] },
}

type ExportResultRow = {
  id: string
  title: string | null
  team_name: string | null
  status: string | null
  rank: number | null
  avg_score: number | string | null
  peer_vote_count: number | null
  is_finalist: boolean | null
}

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const forbidden = requirePortalFeatures(auth, [PORTAL_RESULTS_FEATURE])
    if (forbidden) return forbidden

    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    if (!competitionId) return NextResponse.json({ error: 'competition_id is required' }, { status: 400 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const locale = await resolvePortalLocale(req, { auth, container })

    // The competition has to exist in the caller's own tenant + organisation: the id arrives
    // straight from the query string, and without this the export was reachable for any
    // competition id the caller could guess.
    const competition = await em.findOne(Competition, {
      id: competitionId, tenantId: auth.tenantId, organizationId: auth.orgId, deletedAt: null,
    } as FilterQuery<Competition>)
    if (!competition) return NextResponse.json({ error: 'Competition not found' }, { status: 404 })

    // Stage gate: the portal exposes the ranking only once results are published, which is the
    // same line the portal results page draws. Judging still in progress must not be
    // downloadable by the people being judged.
    if (!areResultsPublished(competition.stage)) {
      return NextResponse.json({ error: RESULTS_NOT_PUBLISHED_MESSAGE }, { status: 403 })
    }

    // Get leaderboard data with scores
    const rows = await rawAll<ExportResultRow>(em,
      `SELECT
         p.id AS id,
         p.title AS title,
         t.name AS team_name,
         p.status AS status,
         p."rank" AS "rank",
         s.avg_score AS avg_score,
         p.peer_vote_count AS peer_vote_count,
         t.is_finalist AS is_finalist
       FROM projects_project p
       LEFT JOIN teams_team t ON p.team_id = t.id AND t.tenant_id = p.tenant_id
         AND t.organization_id = p.organization_id
       LEFT JOIN (
         SELECT project_id, avg(total_score) AS avg_score
         FROM judging_project_score
         WHERE is_submitted = true
           AND competition_id = ?
           AND tenant_id = ?
           AND organization_id = ?
         GROUP BY project_id
       ) s ON s.project_id = p.id
       WHERE p.competition_id = ?
         AND p.tenant_id = ?
         AND p.organization_id = ?
         AND p.deleted_at IS NULL
         AND p.status <> 'draft'
       ORDER BY COALESCE(p.rank, 9999) ASC, COALESCE(s.avg_score, 0) DESC`,
      [competitionId, auth.tenantId, auth.orgId, competitionId, auth.tenantId, auth.orgId],
    )

    const translatedRows = await applyPortalTranslationOverlays(
      rows.map((row) => ({
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
    const csvRows = translatedRows.map((row, i) => {
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
