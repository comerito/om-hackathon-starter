import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { TeamMember, Team } from '../../../data/entities'
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

    // Find user's membership in this competition
    const membership = await em.findOne(TeamMember, {
      customerUserId: auth.sub,
      competitionId,
      deletedAt: null,
    } as FilterQuery<TeamMember>)

    if (!membership) {
      return NextResponse.json({ membership: null, team: null })
    }

    // Fetch team details
    const team = await em.findOne(Team, {
      id: membership.teamId,
      deletedAt: null,
    } as FilterQuery<Team>)

    // Fetch all team members
    const members = await em.find(TeamMember, {
      teamId: membership.teamId,
      deletedAt: null,
    } as FilterQuery<TeamMember>)

    // Resolve member display names
    const memberIds = members.map(m => m.customerUserId)
    const knex = (em as any).getConnection().getKnex()
    const userRows = memberIds.length > 0
      ? await knex('customer_users').select('id', 'display_name', 'email').whereIn('id', memberIds)
      : []
    const userMap = new Map<string, { displayName: string; email: string }>(
      userRows.map((r: any) => [r.id, { displayName: r.display_name ?? r.email?.split('@')[0] ?? 'Unknown', email: r.email ?? '' }]),
    )

    return NextResponse.json({
      membership: {
        id: membership.id,
        team_id: membership.teamId,
        customer_user_id: membership.customerUserId,
        competition_id: membership.competitionId,
        role: membership.role,
        joined_at: membership.joinedAt,
      },
      team: team ? {
        id: team.id,
        name: team.name,
        description: team.description,
        status: team.status,
        track_id: team.trackId,
        competition_id: team.competitionId,
      } : null,
      members: members.map(m => {
        const user = userMap.get(m.customerUserId)
        return {
          id: m.id,
          customer_user_id: m.customerUserId,
          role: m.role,
          joined_at: m.joinedAt,
          display_name: user?.displayName ?? m.customerUserId.slice(0, 8) + '...',
          email: user?.email ?? '',
        }
      }),
    })
  } catch (error) {
    console.error('[portal/my-membership] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'My team membership',
  methods: { GET: { summary: 'Get current user\'s team membership, team details, and members list' } },
}
