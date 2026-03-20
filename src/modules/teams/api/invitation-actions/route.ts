import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { TeamInvitation, InvitationStatus } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const actionSchema = z.object({
  invitation_id: z.string().uuid(),
  action: z.enum(['accept', 'decline', 'cancel']),
})

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['teams.manage'] },
}

export async function POST(request: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }

    const body = await request.json()
    const parsed = actionSchema.parse(body)
    const em = container.resolve('em') as EntityManager

    const invitation = await em.findOne(TeamInvitation, {
      id: parsed.invitation_id,
      tenantId: auth.tenantId,
    } as FilterQuery<TeamInvitation>)

    if (!invitation) {
      return new Response(JSON.stringify({ error: 'Invitation not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      return new Response(JSON.stringify({ error: `Cannot ${parsed.action} — invitation is ${invitation.status}` }), { status: 422, headers: { 'content-type': 'application/json' } })
    }

    const statusMap: Record<string, string> = {
      accept: InvitationStatus.ACCEPTED,
      decline: InvitationStatus.DECLINED,
      cancel: InvitationStatus.CANCELLED,
    }

    invitation.status = statusMap[parsed.action] as typeof invitation.status
    invitation.respondedAt = new Date()
    await em.persistAndFlush(invitation)

    // Emit event
    const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
    const eventId = parsed.action === 'accept' ? 'teams.invitation.accepted' : 'teams.invitation.declined'
    if (parsed.action !== 'cancel') {
      await eventBus.emit(eventId, {
        invitationId: invitation.id,
        teamId: invitation.teamId,
        inviteeId: invitation.inviteeId,
        inviterId: invitation.inviterId,
        tenantId: auth.tenantId,
        organizationId: invitation.organizationId,
      })
    }

    return new Response(JSON.stringify({ ok: true, status: invitation.status }), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: error.issues }), { status: 422, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Teams',
  summary: 'Invitation actions',
  methods: {
    POST: { summary: 'Accept, decline, or cancel a team invitation' },
  },
}
