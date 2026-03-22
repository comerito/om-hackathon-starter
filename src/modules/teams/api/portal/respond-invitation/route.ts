import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { TeamInvitation, InvitationStatus, TeamMember, TeamRole, InvitationType } from '../../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const respondSchema = z.object({
  invitation_id: z.string().uuid(),
  action: z.enum(['accept', 'decline']),
})

export const metadata = {
  POST: { requireCustomerAuth: true },
}

export async function POST(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = respondSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    const invitation = await em.findOne(TeamInvitation, {
      id: parsed.invitation_id,
      tenantId: auth.tenantId,
    } as FilterQuery<TeamInvitation>)
    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      return NextResponse.json({ error: `Invitation is already ${invitation.status}` }, { status: 422 })
    }

    // Authorization: user must be the responder
    // For INVITE type: invitee responds
    // For JOIN_REQUEST type: team owner responds
    if (invitation.type === InvitationType.INVITE && invitation.inviteeId !== auth.sub) {
      return NextResponse.json({ error: 'You can only respond to your own invitations' }, { status: 403 })
    }
    if (invitation.type === InvitationType.JOIN_REQUEST) {
      // Check if caller is the team owner
      const ownership = await em.findOne(TeamMember, {
        teamId: invitation.teamId,
        customerUserId: auth.sub,
        role: TeamRole.OWNER,
        deletedAt: null,
      } as FilterQuery<TeamMember>)
      if (!ownership) {
        return NextResponse.json({ error: 'Only the team owner can respond to join requests' }, { status: 403 })
      }
    }

    if (parsed.action === 'accept') {
      // Determine who joins the team
      const joiningUserId = invitation.type === InvitationType.INVITE
        ? invitation.inviteeId   // The person who was invited
        : invitation.inviterId   // The person who requested to join

      // Check they're not already on a team
      const existingMember = await em.findOne(TeamMember, {
        customerUserId: joiningUserId,
        competitionId: invitation.competitionId,
        deletedAt: null,
      } as FilterQuery<TeamMember>)
      if (existingMember) {
        return NextResponse.json({ error: 'This user is already on a team' }, { status: 409 })
      }

      // Create team member
      const member = em.create(TeamMember, {
        teamId: invitation.teamId,
        customerUserId: joiningUserId,
        competitionId: invitation.competitionId,
        role: TeamRole.MEMBER,
        joinedAt: new Date(),
        tenantId: auth.tenantId!,
        organizationId: invitation.organizationId,
      })
      await em.persistAndFlush(member)

      invitation.status = InvitationStatus.ACCEPTED
      invitation.respondedAt = new Date()
      await em.persistAndFlush(invitation)

      return NextResponse.json({ ok: true, status: 'accepted', member_id: member.id })
    }

    // Decline
    invitation.status = InvitationStatus.DECLINED
    invitation.respondedAt = new Date()
    await em.persistAndFlush(invitation)

    return NextResponse.json({ ok: true, status: 'declined' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[portal/respond-invitation] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Respond to invitation',
  methods: { POST: { summary: 'Accept or decline a team invitation or join request' } },
}
