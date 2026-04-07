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
    const userId = url.searchParams.get('user_id')
    if (!competitionId || !userId) {
      return NextResponse.json({ error: 'competition_id and user_id required' }, { status: 400 })
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const knex = (em as any).getConnection().getKnex()

    // Verify both participate
    const count = await em.count(CompetitionParticipation, {
      competitionId,
      customerUserId: { $in: [auth.sub, userId] },
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)
    if (count < 2) return NextResponse.json({ threadId: null })

    const result = await knex.raw(`
      SELECT m.thread_id
      FROM messages m
      JOIN message_recipients mr ON mr.message_id = m.id
      WHERE m.source_entity_type = 'competition'
        AND m.source_entity_id = ?
        AND m.type = 'chat'
        AND m.deleted_at IS NULL
        AND m.tenant_id = ?
        AND (
          (m.sender_user_id = ? AND mr.recipient_user_id = ?)
          OR (m.sender_user_id = ? AND mr.recipient_user_id = ?)
        )
      LIMIT 1
    `, [competitionId, auth.tenantId, auth.sub, userId, userId, auth.sub])

    return NextResponse.json({ threadId: result.rows[0]?.thread_id ?? null })
  } catch (error) {
    console.error('[portal/chat/find-thread] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Find chat thread',
  methods: {
    GET: { summary: 'Find existing chat thread between current user and another participant' },
  },
}
