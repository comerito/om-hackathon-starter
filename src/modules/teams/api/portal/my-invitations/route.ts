import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { TeamInvitation, InvitationStatus, Team, TeamMember, TeamRole } from '../../../data/entities'
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

    // Invitations received by this user (type=invite, inviteeId=me)
    const received = await em.find(TeamInvitation, {
      inviteeId: auth.sub,
      competitionId,
      status: InvitationStatus.PENDING,
      tenantId: auth.tenantId,
    } as FilterQuery<TeamInvitation>)

    // Join requests sent by this user (type=join_request, inviterId=me)
    const sentRequests = await em.find(TeamInvitation, {
      inviterId: auth.sub,
      competitionId,
      type: 'join_request',
      status: InvitationStatus.PENDING,
      tenantId: auth.tenantId,
    } as FilterQuery<TeamInvitation>)

    // If user is a team owner: find join requests TO their team
    const myOwnership = await em.findOne(TeamMember, {
      customerUserId: auth.sub,
      competitionId,
      role: TeamRole.OWNER,
      deletedAt: null,
      tenantId: auth.tenantId,
    } as FilterQuery<TeamMember>)

    let teamJoinRequests: TeamInvitation[] = []
    if (myOwnership) {
      const allTeamInvitations = await em.find(TeamInvitation, {
        teamId: myOwnership.teamId,
        status: InvitationStatus.PENDING,
        type: 'join_request',
        tenantId: auth.tenantId,
      } as FilterQuery<TeamInvitation>)
      // Filter out requests sent by the owner themselves
      teamJoinRequests = allTeamInvitations.filter(inv => inv.inviterId !== auth.sub)
    }

    // Resolve team names for display
    const teamIds = [...new Set([
      ...received.map(i => i.teamId),
      ...sentRequests.map(i => i.teamId),
      ...teamJoinRequests.map(i => i.teamId),
    ])]
    const teams = teamIds.length > 0
      ? await em.find(Team, { id: { $in: teamIds }, tenantId: auth.tenantId } as FilterQuery<Team>)
      : []
    const teamMap = new Map(teams.map(t => [t.id, t.name]))

    const mapInvitation = (inv: TeamInvitation) => ({
      id: inv.id,
      team_id: inv.teamId,
      team_name: teamMap.get(inv.teamId) ?? 'Unknown',
      inviter_id: inv.inviterId,
      invitee_id: inv.inviteeId,
      type: inv.type,
      status: inv.status,
      message: inv.message,
      created_at: inv.createdAt,
      expires_at: inv.expiresAt,
    })

    return NextResponse.json({
      received: received.map(mapInvitation),
      sent: sentRequests.map(mapInvitation),
      team_join_requests: teamJoinRequests.map(mapInvitation),
    })
  } catch (error) {
    console.error('[portal/my-invitations] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'My invitations',
  methods: { GET: { summary: 'List pending invitations (received, sent, team join requests)' } },
}
