import { NextResponse } from 'next/server'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['competitions.participants.manage'] },
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    const status = url.searchParams.get('status') // pending | accepted | expired | all

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const knex = (em as any).getConnection().getKnex()

    let query = knex('competitions_invitation as ci')
      .join('customer_user_invitations as cui', 'cui.id', 'ci.customer_invitation_id')
      .where('ci.tenant_id', auth.tenantId)
      .select(
        'ci.id',
        'ci.customer_invitation_id',
        'ci.competition_id',
        'ci.participation_role',
        'ci.created_at',
        'cui.email',
        'cui.display_name',
        'cui.accepted_at',
        'cui.cancelled_at',
        'cui.expires_at',
      )
      .orderBy('ci.created_at', 'desc')
      .limit(200)

    if (competitionId) {
      query = query.where('ci.competition_id', competitionId)
    }

    const rows = await query

    // Also fetch competition names
    const compIds = [...new Set(rows.map((r: any) => r.competition_id))]
    const compRows = compIds.length > 0
      ? await knex('competitions_competition').select('id', 'name').whereIn('id', compIds)
      : []
    const compMap = new Map<string, string>(compRows.map((r: any) => [r.id, r.name]))

    const now = Date.now()
    const items = rows.map((r: any) => {
      const isAccepted = !!r.accepted_at
      const isCancelled = !!r.cancelled_at
      const isExpired = r.expires_at ? new Date(r.expires_at).getTime() < now : false
      let invStatus = 'pending'
      if (isAccepted) invStatus = 'accepted'
      else if (isCancelled) invStatus = 'cancelled'
      else if (isExpired) invStatus = 'expired'

      return {
        id: r.id,
        competition_id: r.competition_id,
        competition_name: compMap.get(r.competition_id) ?? null,
        participation_role: r.participation_role,
        email: r.email,
        display_name: r.display_name,
        status: invStatus,
        accepted_at: r.accepted_at,
        cancelled_at: r.cancelled_at,
        expires_at: r.expires_at,
        created_at: r.created_at,
      }
    })

    // Filter by status if requested
    const filtered = status && status !== 'all'
      ? items.filter((i: any) => i.status === status)
      : items

    return NextResponse.json({ items: filtered, total: filtered.length })
  } catch (error) {
    console.error('[admin/invitations] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Competition invitations list',
  methods: { GET: { summary: 'List all competition invitations with status' } },
}
