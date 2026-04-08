import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Team, TeamMember, TeamInvitation, InvitationType, InvitationStatus, TeamRole } from '../../../data/entities'
import { CompetitionParticipation, ParticipationRole } from '../../../../competitions/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const inviteSchema = z.object({
  team_id: z.string().uuid(),
  invitee_id: z.string().uuid(),
  message: z.string().max(500).optional(),
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
    const parsed = inviteSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Verify caller is team owner
    const ownership = await em.findOne(TeamMember, {
      teamId: parsed.team_id,
      customerUserId: auth.sub,
      role: TeamRole.OWNER,
      deletedAt: null,
      tenantId: auth.tenantId,
    } as FilterQuery<TeamMember>)
    if (!ownership) {
      return NextResponse.json({ error: 'Only the team owner can invite members' }, { status: 403 })
    }

    const team = await em.findOne(Team, {
      id: parsed.team_id,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<Team>)
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Check invitee is a participant (not a judge or mentor)
    const inviteeParticipation = await em.findOne(CompetitionParticipation, {
      customerUserId: parsed.invitee_id,
      competitionId: team.competitionId,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)
    if (!inviteeParticipation || inviteeParticipation.role !== ParticipationRole.PARTICIPANT) {
      return NextResponse.json({ error: 'Only participants can be invited to teams' }, { status: 403 })
    }

    // Check invitee is not already on a team in this competition
    const existingMember = await em.findOne(TeamMember, {
      customerUserId: parsed.invitee_id,
      competitionId: team.competitionId,
      deletedAt: null,
    } as FilterQuery<TeamMember>)
    if (existingMember) {
      return NextResponse.json({ error: 'This user is already on a team' }, { status: 409 })
    }

    // Check no pending invitation already exists
    const existingInvite = await em.findOne(TeamInvitation, {
      teamId: parsed.team_id,
      inviteeId: parsed.invitee_id,
      status: InvitationStatus.PENDING,
      tenantId: auth.tenantId,
    } as FilterQuery<TeamInvitation>)
    if (existingInvite) {
      return NextResponse.json({ error: 'Invitation already pending for this user' }, { status: 409 })
    }

    // Create invitation
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const invitation = em.create(TeamInvitation, {
      teamId: parsed.team_id,
      inviterId: auth.sub,
      inviteeId: parsed.invitee_id,
      type: InvitationType.INVITE,
      status: InvitationStatus.PENDING,
      message: parsed.message ?? null,
      createdAt: new Date(),
      expiresAt,
      competitionId: team.competitionId,
      tenantId: auth.tenantId!,
      organizationId: team.organizationId,
    })
    await em.persistAndFlush(invitation)

    return NextResponse.json({ ok: true, invitation_id: invitation.id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[portal/invite-member] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Invite member to team',
  methods: { POST: { summary: 'Team owner invites a participant to join their team' } },
}
