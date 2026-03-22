import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { PeerVote } from '../../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = { GET: { requireCustomerAuth: true } }

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    if (!competitionId) return NextResponse.json({ error: 'competition_id required' }, { status: 400 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    const votes = await em.find(PeerVote, {
      voterId: auth.sub, competitionId, tenantId: auth.tenantId, organizationId: auth.orgId,
    } as FilterQuery<PeerVote>)

    return NextResponse.json({
      votes: votes.map(v => ({ id: v.id, project_id: v.projectId, created_at: v.createdAt })),
      count: votes.length,
    })
  } catch (error) {
    console.error('[portal/my-votes] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal', summary: 'My votes',
  methods: { GET: { summary: 'Get current user\'s votes' } },
}
