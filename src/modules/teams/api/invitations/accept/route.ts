import { NextResponse, type NextRequest } from 'next/server'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { AuthContext } from '@open-mercato/shared/lib/auth/server'
import { Team, TeamMember, TeamInvitation, TeamRole, TeamStatus, InvitationStatus } from '../../../data/entities'
import { acceptInvitationSchema } from '../../../data/validators'
import { teamsTag, okSchema, errorSchema } from '../../openapi'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata = {
  POST: { requireAuth: true },
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  _ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  const body = await req.json().catch(() => ({}))
  const parsed = acceptInvitationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { invitationId } = parsed.data
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager

  // Load invitation
  const invitation = await em.findOne(TeamInvitation, {
    id: invitationId,
    status: InvitationStatus.PENDING,
  } as FilterQuery<TeamInvitation>)

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found or no longer pending' }, { status: 404 })
  }

  // Check if expired
  if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
    // Mark as expired
    invitation.status = InvitationStatus.EXPIRED
    await em.flush()
    return NextResponse.json({ error: 'Invitation has expired' }, { status: 422 })
  }

  // Load team and lock for capacity check
  const knex = em.getKnex()
  const [teamRow] = await knex('teams_team')
    .where({ id: invitation.teamId, deleted_at: null })
    .forUpdate()
    .select('*')

  if (!teamRow) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 })
  }

  if (teamRow.status !== TeamStatus.ACTIVE) {
    return NextResponse.json({ error: 'Team is not active' }, { status: 422 })
  }

  // Determine the invitee userId based on invitation type
  // For INVITE: invitee is the user being invited
  // For JOIN_REQUEST: invitee is the user who requested to join
  const customerUserId = invitation.inviteeId

  // Check if user is already on a team for this competition
  const existingMembership = await em.findOne(TeamMember, {
    customerUserId,
    competitionId: invitation.competitionId,
    deletedAt: null,
  } as FilterQuery<TeamMember>)

  if (existingMembership) {
    return NextResponse.json(
      { error: 'User is already a member of a team in this competition' },
      { status: 422 },
    )
  }

  // Check team size limit — load competition for max_team_size
  const [compRow] = await knex('competitions_competition')
    .where({ id: invitation.competitionId })
    .select('max_team_size')

  const maxTeamSize = compRow?.max_team_size ?? 5
  const currentMemberCount = await em.count(TeamMember, {
    teamId: invitation.teamId,
    deletedAt: null,
  } as FilterQuery<TeamMember>)

  if (currentMemberCount >= maxTeamSize) {
    return NextResponse.json({ error: 'Team is full' }, { status: 422 })
  }

  const now = new Date()

  // Atomic: create member, update invitation, cancel other pending invitations
  try {
    await withAtomicFlush(
      em,
      [
        () => {
          // Create team member
          const member = new TeamMember()
          member.teamId = invitation.teamId
          member.customerUserId = customerUserId
          member.competitionId = invitation.competitionId
          member.role = TeamRole.MEMBER
          member.tenantId = invitation.tenantId
          member.organizationId = invitation.organizationId
          em.persist(member)

          // Accept this invitation
          invitation.status = InvitationStatus.ACCEPTED
          invitation.respondedAt = now
        },
      ],
      { transaction: true },
    )
  } catch (err: unknown) {
    // Handle unique constraint violation (user already on a team)
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('unique') || message.includes('duplicate')) {
      return NextResponse.json(
        { error: 'User is already a member of a team in this competition' },
        { status: 422 },
      )
    }
    throw err
  }

  // Cancel other pending invitations for this user in the same competition
  await knex('teams_invitation')
    .where({
      invitee_id: customerUserId,
      competition_id: invitation.competitionId,
      status: InvitationStatus.PENDING,
    })
    .whereNot({ id: invitationId })
    .update({
      status: InvitationStatus.CANCELLED,
      responded_at: now.toISOString(),
    })

  // Emit event
  try {
    const eventBus = container.resolve('eventBus') as {
      emit?: (event: string, payload: unknown) => Promise<void>
      emitEvent?: (event: string, payload: unknown) => Promise<void>
    }

    const eventPayload = {
      invitationId: invitation.id,
      teamId: invitation.teamId,
      customerUserId,
      competitionId: invitation.competitionId,
      tenantId: invitation.tenantId,
      organizationId: invitation.organizationId,
    }

    if (typeof eventBus.emit === 'function') {
      await eventBus.emit('teams.invitation.accepted', eventPayload)
      await eventBus.emit('teams.member.joined', eventPayload)
    } else if (typeof eventBus.emitEvent === 'function') {
      await eventBus.emitEvent('teams.invitation.accepted', eventPayload)
      await eventBus.emitEvent('teams.member.joined', eventPayload)
    }
  } catch (err) {
    console.warn('[teams] Failed to emit invitation.accepted event', {
      invitationId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return NextResponse.json({
    ok: true,
    teamId: invitation.teamId,
  })
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

export const openApi: OpenApiRouteDoc = {
  POST: {
    summary: 'Accept an invitation or join request',
    description:
      'Accepts a pending invitation. Atomically creates TeamMember, updates invitation status, ' +
      'and cancels other pending invitations for the same user in the competition. ' +
      'Validates team capacity and handles constraint violations.',
    tags: [teamsTag],
    requestBody: {
      required: true,
      content: {
        'application/json': { schema: acceptInvitationSchema },
      },
    },
    responses: {
      200: {
        description: 'Invitation accepted, member created',
        content: { 'application/json': { schema: okSchema } },
      },
      400: {
        description: 'Invalid request body',
        content: { 'application/json': { schema: errorSchema } },
      },
      404: {
        description: 'Invitation not found or not pending',
        content: { 'application/json': { schema: errorSchema } },
      },
      422: {
        description: 'Team full, invitation expired, or user already on a team',
        content: { 'application/json': { schema: errorSchema } },
      },
    },
  },
}
