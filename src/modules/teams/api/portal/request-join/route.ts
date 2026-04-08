import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Team, TeamMember, TeamInvitation, InvitationType, InvitationStatus, TeamRole } from '../../../data/entities'
import { CompetitionParticipation, ParticipationRole } from '../../../../competitions/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const requestJoinSchema = z.object({
  team_id: z.string().uuid(),
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
    const parsed = requestJoinSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Fetch team
    const team = await em.findOne(Team, {
      id: parsed.team_id,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<Team>)
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Only participants can join teams
    const participation = await em.findOne(CompetitionParticipation, {
      customerUserId: auth.sub,
      competitionId: team.competitionId,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)
    if (!participation || participation.role !== ParticipationRole.PARTICIPANT) {
      return NextResponse.json({ error: 'Only participants can join teams' }, { status: 403 })
    }

    // Check user not already on a team
    const existingMember = await em.findOne(TeamMember, {
      customerUserId: auth.sub,
      competitionId: team.competitionId,
      deletedAt: null,
    } as FilterQuery<TeamMember>)
    if (existingMember) {
      return NextResponse.json({ error: 'You are already on a team in this competition' }, { status: 409 })
    }

    // Check no pending request already exists
    const existingRequest = await em.findOne(TeamInvitation, {
      teamId: parsed.team_id,
      inviterId: auth.sub,
      status: InvitationStatus.PENDING,
      tenantId: auth.tenantId,
    } as FilterQuery<TeamInvitation>)
    if (existingRequest) {
      return NextResponse.json({ error: 'You already have a pending request for this team' }, { status: 409 })
    }

    // Find team owner (the invitee for join requests)
    const owner = await em.findOne(TeamMember, {
      teamId: parsed.team_id,
      role: TeamRole.OWNER,
      deletedAt: null,
    } as FilterQuery<TeamMember>)
    if (!owner) {
      return NextResponse.json({ error: 'Team has no owner' }, { status: 422 })
    }

    // Create join request
    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setDate(expiresAt.getDate() + 7)

    const invitation = em.create(TeamInvitation, {
      teamId: parsed.team_id,
      inviterId: auth.sub,
      inviteeId: owner.customerUserId,
      type: InvitationType.JOIN_REQUEST,
      status: InvitationStatus.PENDING,
      message: parsed.message ?? null,
      createdAt: now,
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
    console.error('[portal/request-join] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Request to join team',
  methods: { POST: { summary: 'Send a join request to a team' } },
}
