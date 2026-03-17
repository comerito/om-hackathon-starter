import { NextResponse, type NextRequest } from 'next/server'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { AuthContext } from '@open-mercato/shared/lib/auth/server'
import { Team, TeamMember, TeamRole, TeamStatus } from '../../../data/entities'
import { assignMemberSchema } from '../../../data/validators'
import { teamsTag, errorSchema } from '../../openapi'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['teams.manage'] },
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  _ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  const body = await req.json().catch(() => ({}))
  const parsed = assignMemberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { teamId, customerUserId, competitionId } = parsed.data
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager

  // Load team
  const team = await em.findOne(Team, {
    id: teamId,
    status: TeamStatus.ACTIVE,
    deletedAt: null,
  } as FilterQuery<Team>)

  if (!team) {
    return NextResponse.json({ error: 'Team not found or inactive' }, { status: 404 })
  }

  // Check if user is already on a team for this competition
  const existingMembership = await em.findOne(TeamMember, {
    customerUserId,
    competitionId,
    deletedAt: null,
  } as FilterQuery<TeamMember>)

  if (existingMembership) {
    return NextResponse.json(
      { error: 'Participant is already on a team in this competition' },
      { status: 422 },
    )
  }

  // Create membership
  let member: TeamMember | null = null
  await withAtomicFlush(
    em,
    [
      () => {
        const memberData = {
          teamId,
          customerUserId,
          competitionId,
          role: TeamRole.MEMBER,
          tenantId: team.tenantId,
          organizationId: team.organizationId,
        }
        member = new TeamMember()
        Object.assign(member, memberData)
        em.persist(member)
      },
    ],
    { transaction: true },
  )

  // Emit event
  try {
    const eventBus = container.resolve('eventBus') as {
      emit?: (event: string, payload: unknown) => Promise<void>
      emitEvent?: (event: string, payload: unknown) => Promise<void>
    }

    const eventPayload = {
      teamId,
      customerUserId,
      competitionId,
      role: TeamRole.MEMBER,
      assignedByAdmin: true,
      tenantId: team.tenantId,
      organizationId: team.organizationId,
    }

    if (typeof eventBus.emit === 'function') {
      await eventBus.emit('teams.member.joined', eventPayload)
    } else if (typeof eventBus.emitEvent === 'function') {
      await eventBus.emitEvent('teams.member.joined', eventPayload)
    }
  } catch (err) {
    console.warn('[teams] Failed to emit member joined event', {
      teamId,
      customerUserId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return NextResponse.json({
    ok: true,
    member: member ? { id: (member as TeamMember).id, teamId, customerUserId } : null,
  }, { status: 201 })
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

export const openApi: OpenApiRouteDoc = {
  POST: {
    summary: 'Assign a participant to a team (admin)',
    description: 'Admin action to directly add a participant to a team without invitation flow.',
    tags: [teamsTag],
    requestBody: {
      required: true,
      content: {
        'application/json': { schema: assignMemberSchema },
      },
    },
    responses: {
      201: {
        description: 'Member assigned',
        content: {
          'application/json': {
            schema: z.object({
              ok: z.literal(true),
              member: z.object({
                id: z.string().uuid(),
                teamId: z.string().uuid(),
                customerUserId: z.string().uuid(),
              }).nullable(),
            }),
          },
        },
      },
      400: {
        description: 'Invalid request body',
        content: { 'application/json': { schema: errorSchema } },
      },
      404: {
        description: 'Team not found',
        content: { 'application/json': { schema: errorSchema } },
      },
      422: {
        description: 'Participant already on a team',
        content: { 'application/json': { schema: errorSchema } },
      },
    },
  },
}
