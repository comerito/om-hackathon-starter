import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Message, MessageRecipient } from '@open-mercato/core/modules/messages/data/entities'
import { CompetitionParticipation } from '../../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireCustomerAuth: true },
  POST: { requireCustomerAuth: true },
}

// GET: List conversations for current user in a competition
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
    if (!participation) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

    // Find all threads where user is sender or recipient
    const threads = await knex.raw(`
      SELECT DISTINCT m.thread_id
      FROM messages m
      LEFT JOIN message_recipients mr ON mr.message_id = m.id
      WHERE m.source_entity_type = 'competition'
        AND m.source_entity_id = ?
        AND m.type = 'chat'
        AND m.status = 'sent'
        AND m.deleted_at IS NULL
        AND m.tenant_id = ?
        AND (m.sender_user_id = ? OR mr.recipient_user_id = ?)
    `, [competitionId, auth.tenantId, auth.sub, auth.sub])

    const threadIds = threads.rows.map((r: any) => r.thread_id).filter(Boolean) as string[]
    if (threadIds.length === 0) return NextResponse.json({ items: [] })

    // For each thread: latest message, other user, unread count
    const conversationsRaw = await knex.raw(`
      SELECT DISTINCT ON (m.thread_id)
        m.thread_id,
        m.id as message_id,
        m.body,
        m.sender_user_id,
        m.sent_at,
        CASE
          WHEN m.sender_user_id = ? THEN mr.recipient_user_id
          ELSE m.sender_user_id
        END as other_user_id
      FROM messages m
      LEFT JOIN message_recipients mr ON mr.message_id = m.id
      WHERE m.thread_id = ANY(?)
        AND m.type = 'chat'
        AND m.status = 'sent'
        AND m.deleted_at IS NULL
      ORDER BY m.thread_id, m.sent_at DESC
    `, [auth.sub, threadIds])

    // Get unread counts per thread
    const unreadRaw = await knex.raw(`
      SELECT m.thread_id, COUNT(*)::int as unread_count
      FROM message_recipients mr
      JOIN messages m ON m.id = mr.message_id
      WHERE m.thread_id = ANY(?)
        AND m.type = 'chat'
        AND m.deleted_at IS NULL
        AND mr.recipient_user_id = ?
        AND mr.status = 'unread'
      GROUP BY m.thread_id
    `, [threadIds, auth.sub])
    const unreadMap = new Map(unreadRaw.rows.map((r: any) => [r.thread_id, r.unread_count]))

    // Resolve user names
    const otherUserIds = [...new Set(conversationsRaw.rows.map((r: any) => r.other_user_id).filter(Boolean))]
    const userRows = otherUserIds.length > 0
      ? await knex('customer_users').select('id', 'display_name', 'email').whereIn('id', otherUserIds)
      : []
    const userMap = new Map<string, { displayName: string; email: string }>(userRows.map((u: any) => [u.id, { displayName: u.display_name || u.email?.split('@')[0] || 'Unknown', email: u.email }]))

    // Resolve avatar URLs from participant profiles
    const profileRows = otherUserIds.length > 0
      ? await knex('competitions_participant_profile').select('customer_user_id', 'avatar_url').whereIn('customer_user_id', otherUserIds).where('tenant_id', auth.tenantId)
      : []
    const avatarMap = new Map(profileRows.map((p: any) => [p.customer_user_id, p.avatar_url]))

    const items = conversationsRaw.rows.map((r: any) => ({
      threadId: r.thread_id,
      lastMessage: {
        id: r.message_id,
        body: r.body?.substring(0, 100) ?? '',
        sentAt: r.sent_at,
        isMine: r.sender_user_id === auth.sub,
      },
      otherUser: {
        id: r.other_user_id,
        displayName: userMap.get(r.other_user_id)?.displayName ?? 'Unknown',
        avatarUrl: avatarMap.get(r.other_user_id) ?? null,
      },
      unreadCount: unreadMap.get(r.thread_id) ?? 0,
    }))

    // Sort by most recent message
    items.sort((a: any, b: any) => new Date(b.lastMessage.sentAt).getTime() - new Date(a.lastMessage.sentAt).getTime())

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[portal/chat] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const sendSchema = z.object({
  competition_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  body: z.string().min(1).max(5000),
  thread_id: z.string().uuid().optional(),
})

// POST: Send a chat message
export async function POST(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const body = await req.json()
    const parsed = sendSchema.parse(body)

    if (parsed.recipient_id === auth.sub) {
      return NextResponse.json({ error: 'Cannot message yourself' }, { status: 422 })
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const knex = (em as any).getConnection().getKnex()

    // Verify both users participate in the competition
    const participations = await em.find(CompetitionParticipation, {
      competitionId: parsed.competition_id,
      customerUserId: { $in: [auth.sub, parsed.recipient_id] },
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)

    if (participations.length < 2) {
      return NextResponse.json({ error: 'Both users must be participants in this competition' }, { status: 403 })
    }

    // Find or create thread
    let threadId = parsed.thread_id
    if (!threadId) {
      const existingThread = await knex.raw(`
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
      `, [parsed.competition_id, auth.tenantId, auth.sub, parsed.recipient_id, parsed.recipient_id, auth.sub])

      threadId = existingThread.rows[0]?.thread_id ?? null
    }

    if (!threadId) {
      threadId = crypto.randomUUID()
    }

    // Create message
    const messageId = crypto.randomUUID()
    const message = new Message()
    message.id = messageId
    message.type = 'chat'
    message.threadId = threadId
    message.senderUserId = auth.sub
    message.subject = ''
    message.body = parsed.body
    message.bodyFormat = 'text'
    message.status = 'sent'
    message.isDraft = false
    message.sentAt = new Date()
    message.tenantId = auth.tenantId
    message.organizationId = auth.orgId
    message.sourceEntityType = 'competition'
    message.sourceEntityId = parsed.competition_id
    em.persist(message)

    const recipient = new MessageRecipient()
    recipient.messageId = messageId
    recipient.recipientUserId = parsed.recipient_id
    recipient.recipientType = 'to'
    recipient.status = 'unread'
    em.persist(recipient)

    await em.flush()

    // Emit event for real-time
    try {
      const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
      await eventBus.emit('competitions.chat.message_sent', {
        messageId: message.id,
        threadId,
        senderUserId: auth.sub,
        recipientUserId: parsed.recipient_id,
        competitionId: parsed.competition_id,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
      })
    } catch { /* event emission is best-effort */ }

    return NextResponse.json({
      ok: true,
      message: { id: message.id, threadId, body: message.body, sentAt: message.sentAt },
    })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed' }, { status: 422 })
    console.error('[portal/chat] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Participant chat',
  methods: {
    GET: { summary: 'List chat conversations for current participant' },
    POST: { summary: 'Send a chat message to another participant' },
  },
}
