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

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    const rows = await em.getConnection().execute<Array<{
      id: string
      team_id: string
      role: string
      joined_at: Date | string
    }>>(
      `SELECT id, team_id, role, joined_at FROM teams_team_member
         WHERE customer_user_id = ?
           AND competition_id = ?
           AND tenant_id = ?
           AND left_at IS NULL
         LIMIT 1`,
      [auth.sub, competitionId, auth.tenantId],
    )

    const membership = rows[0] ?? null

    return NextResponse.json({
      items: membership ? [{ id: membership.id, team_id: membership.team_id, role: membership.role, joined_at: membership.joined_at }] : [],
      total: membership ? 1 : 0,
      page: 1,
      pageSize: 10,
      totalPages: membership ? 1 : 0,
    })
  } catch (error) {
    console.error('[portal/my-team-membership] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Teams',
  summary: 'My team membership (portal)',
  methods: { GET: { summary: 'Check current user team membership for a competition' } },
}
