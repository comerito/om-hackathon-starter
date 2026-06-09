import { rawAll, rawFirst } from '../../../../../lib/db'
import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireCustomerAuth: true },
}

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    if (!competitionId) {
      return NextResponse.json({ error: 'competition_id is required' }, { status: 400 })
    }

    const pageSize = Math.min(Number(url.searchParams.get('pageSize') ?? '50'), 100)
    const page = Math.max(Number(url.searchParams.get('page') ?? '1'), 1)
    const sortField = url.searchParams.get('sortField') ?? 'name'
    const sortDir = url.searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc'
    const nameFilter = url.searchParams.get('name')

    const allowedSortFields = ['name', 'created_at', 'status']
    const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'name'

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // safeSortField is whitelisted above; sortDir is normalized to 'asc'|'desc'
    const whereSql = `t.competition_id = ? AND t.tenant_id = ? AND t.deleted_at IS NULL${nameFilter ? ' AND t.name ILIKE ?' : ''}`
    const whereParams: unknown[] = nameFilter
      ? [competitionId, auth.tenantId, `%${nameFilter}%`]
      : [competitionId, auth.tenantId]

    // Count total before pagination
    const countResult = await rawFirst<{ count: number }>(em, `SELECT COUNT(t.id)::int as count FROM teams_team t WHERE ${whereSql}`, whereParams)
    const total = Number(countResult?.count ?? 0)

    // Apply sort and pagination
    const items = await rawAll<any>(em, `
      SELECT t.id, t.competition_id, t.track_id, t.name, t.description, t.status,
             t.is_finalist, t.table_number, t.table_location, t.is_active, t.created_at
      FROM teams_team t
      WHERE ${whereSql}
      ORDER BY t.${safeSortField} ${sortDir.toUpperCase()}
      LIMIT ? OFFSET ?
    `, [...whereParams, pageSize, (page - 1) * pageSize])

    // Fetch member counts and track assignments
    const teamIds = items.map((t: any) => t.id)
    let memberCounts = new Map<string, number>()
    let teamTrackMap = new Map<string, string[]>()
    if (teamIds.length > 0) {
      const counts = await rawAll<{ team_id: string; count: number }>(
        em,
        `SELECT team_id, COUNT(id)::int as count FROM teams_team_member WHERE team_id IN (?) AND left_at IS NULL GROUP BY team_id`,
        [teamIds],
      )
      memberCounts = new Map(counts.map((r: any) => [r.team_id, Number(r.count)]))

      const trackRows = await rawAll<{ team_id: string; track_id: string }>(
        em,
        `SELECT team_id, track_id FROM teams_team_track WHERE team_id IN (?)`,
        [teamIds],
      )
      for (const row of trackRows) {
        const existing = teamTrackMap.get(row.team_id) ?? []
        existing.push(row.track_id)
        teamTrackMap.set(row.team_id, existing)
      }
    }

    const result = items.map((t: any) => ({
      id: t.id,
      competition_id: t.competition_id,
      track_id: t.track_id ?? null,
      track_ids: teamTrackMap.get(t.id) ?? [],
      name: t.name,
      description: t.description ?? null,
      status: t.status,
      is_finalist: Boolean(t.is_finalist),
      table_number: t.table_number ?? null,
      table_location: t.table_location ?? null,
      is_active: Boolean(t.is_active),
      created_at: t.created_at,
      _teams: { memberCount: memberCounts.get(t.id) ?? 0 },
    }))

    return NextResponse.json({
      items: result,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('[portal/browse-teams] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Teams',
  summary: 'Browse teams (portal)',
  methods: { GET: { summary: 'List teams for portal participants' } },
}
