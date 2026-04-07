import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { CompetitionParticipation } from '../../../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireCustomerAuth: true },
}

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    if (!competitionId) return NextResponse.json({ error: 'competition_id required' }, { status: 400 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const knex = (em as any).getConnection().getKnex()

    // Verify participation
    const participation = await em.findOne(CompetitionParticipation, {
      competitionId, customerUserId: auth.sub, tenantId: auth.tenantId, deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)
    if (!participation) return NextResponse.json({ unreadCount: 0 })

    const result = await knex.raw(`
      SELECT COUNT(*)::int as unread_count
      FROM message_recipients mr
      JOIN messages m ON m.id = mr.message_id
      WHERE mr.recipient_user_id = ?
        AND mr.status = 'unread'
        AND m.source_entity_type = 'competition'
        AND m.source_entity_id = ?
        AND m.type = 'chat'
        AND m.deleted_at IS NULL
        AND m.tenant_id = ?
    `, [auth.sub, competitionId, auth.tenantId])

    return NextResponse.json({ unreadCount: result.rows[0]?.unread_count ?? 0 })
  } catch (error) {
    console.error('[portal/chat/unread-count] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Chat unread count',
  methods: {
    GET: { summary: 'Get unread chat message count for current participant' },
  },
}
