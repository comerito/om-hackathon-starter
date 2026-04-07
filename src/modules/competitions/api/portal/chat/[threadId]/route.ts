import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { CompetitionParticipation } from '../../../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireCustomerAuth: true },
  PUT: { requireCustomerAuth: true },
}

// GET: Get messages in a thread
export async function GET(req: Request, { params }: { params: { threadId: string } }) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    if (!competitionId) return NextResponse.json({ error: 'competition_id required' }, { status: 400 })

    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '50')))

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const knex = (em as any).getConnection().getKnex()

    // Verify participation
    const participation = await em.findOne(CompetitionParticipation, {
      competitionId, customerUserId: auth.sub, tenantId: auth.tenantId, deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)
    if (!participation) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

    // Verify user belongs to this thread
    const threadCheck = await knex.raw(`
      SELECT 1 FROM messages m
      LEFT JOIN message_recipients mr ON mr.message_id = m.id
      WHERE m.thread_id = ?
        AND m.type = 'chat'
        AND m.source_entity_type = 'competition'
        AND m.source_entity_id = ?
        AND m.deleted_at IS NULL
        AND (m.sender_user_id = ? OR mr.recipient_user_id = ?)
      LIMIT 1
    `, [params.threadId, competitionId, auth.sub, auth.sub])

    if (threadCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    // Find the other user in this thread
    const otherUserRow = await knex.raw(`
      SELECT DISTINCT
        CASE
          WHEN m.sender_user_id = ? THEN mr.recipient_user_id
          ELSE m.sender_user_id
        END as other_user_id
      FROM messages m
      LEFT JOIN message_recipients mr ON mr.message_id = m.id
      WHERE m.thread_id = ? AND m.type = 'chat' AND m.deleted_at IS NULL
      LIMIT 1
    `, [auth.sub, params.threadId])

    const otherUserId = otherUserRow.rows[0]?.other_user_id
    let otherUser = { id: otherUserId, displayName: 'Unknown', avatarUrl: null as string | null }
    if (otherUserId) {
      const userRow = await knex('customer_users').select('display_name', 'email').where('id', otherUserId).first()
      const profileRow = await knex('competitions_participant_profile').select('avatar_url').where('customer_user_id', otherUserId).where('tenant_id', auth.tenantId).first()
      otherUser = {
        id: otherUserId,
        displayName: userRow?.display_name || userRow?.email?.split('@')[0] || 'Unknown',
        avatarUrl: profileRow?.avatar_url ?? null,
      }
    }

    // Count total messages
    const countResult = await knex.raw(`
      SELECT COUNT(*)::int as total FROM messages
      WHERE thread_id = ? AND type = 'chat' AND status = 'sent' AND deleted_at IS NULL
    `, [params.threadId])
    const total = countResult.rows[0]?.total ?? 0

    // Fetch messages, newest page first but return in chronological order
    const offset = Math.max(0, total - page * pageSize)
    const limit = page === 1 ? Math.min(pageSize, total) : pageSize

    const messagesRaw = await knex('messages')
      .select('id', 'body', 'body_format', 'sender_user_id', 'sent_at')
      .where('thread_id', params.threadId)
      .where('type', 'chat')
      .where('status', 'sent')
      .whereNull('deleted_at')
      .orderBy('sent_at', 'asc')
      .offset(offset < 0 ? 0 : offset)
      .limit(limit)

    const messages = messagesRaw.map((m: any) => ({
      id: m.id,
      body: m.body,
      bodyFormat: m.body_format,
      senderUserId: m.sender_user_id,
      isMine: m.sender_user_id === auth.sub,
      sentAt: m.sent_at,
    }))

    return NextResponse.json({
      ok: true,
      messages,
      thread: { id: params.threadId, otherUser },
      total,
      page,
      pageSize,
      hasMore: offset > 0,
    })
  } catch (error) {
    console.error('[portal/chat/thread] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: Mark thread as read
export async function PUT(req: Request, { params }: { params: { threadId: string } }) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    if (!competitionId) return NextResponse.json({ error: 'competition_id required' }, { status: 400 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const knex = (em as any).getConnection().getKnex()

    // Mark all unread messages in thread as read for current user
    await knex.raw(`
      UPDATE message_recipients mr
      SET status = 'read', read_at = NOW()
      FROM messages m
      WHERE mr.message_id = m.id
        AND m.thread_id = ?
        AND m.type = 'chat'
        AND m.deleted_at IS NULL
        AND mr.recipient_user_id = ?
        AND mr.status = 'unread'
    `, [params.threadId, auth.sub])

    // Emit event
    try {
      const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
      await eventBus.emit('competitions.chat.message_read', {
        threadId: params.threadId,
        userId: auth.sub,
        competitionId,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
      })
    } catch { /* best-effort */ }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[portal/chat/thread] PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Chat thread',
  methods: {
    GET: { summary: 'Get messages in a chat thread' },
    PUT: { summary: 'Mark a chat thread as read' },
  },
}
