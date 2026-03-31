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
    const knex = (em as any).getConnection().getKnex()

    let query = knex('teams_team as t')
      .where('t.competition_id', competitionId)
      .where('t.tenant_id', auth.tenantId)
      .where('t.deleted_at', null)
      .select(
        't.id',
        't.competition_id',
        't.track_id',
        't.name',
        't.description',
        't.status',
        't.is_finalist',
        't.table_number',
        't.table_location',
        't.is_active',
        't.created_at',
      )

    if (nameFilter) {
      query = query.whereRaw('t.name ILIKE ?', [`%${nameFilter}%`])
    }

    // Count total before pagination
    const countResult = await query.clone().clearSelect().count('t.id as count').first()
    const total = Number(countResult?.count ?? 0)

    // Apply sort and pagination
    const items = await query
      .orderBy(`t.${safeSortField}`, sortDir)
      .limit(pageSize)
      .offset((page - 1) * pageSize)

    // Fetch member counts and track assignments
    const teamIds = items.map((t: any) => t.id)
    let memberCounts = new Map<string, number>()
    let teamTrackMap = new Map<string, string[]>()
    if (teamIds.length > 0) {
      const counts = await knex('teams_team_member')
        .whereIn('team_id', teamIds)
        .where('left_at', null)
        .groupBy('team_id')
        .select('team_id')
        .count('id as count')
      memberCounts = new Map(counts.map((r: any) => [r.team_id, Number(r.count)]))

      const trackRows = await knex('teams_team_track')
        .whereIn('team_id', teamIds)
        .select('team_id', 'track_id')
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
