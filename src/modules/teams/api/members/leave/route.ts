import { NextResponse, type NextRequest } from 'next/server'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'

import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { AuthContext } from '@open-mercato/shared/lib/auth/server'
import { TeamMember, TeamRole } from '../../../data/entities'
import { leaveTeamSchema } from '../../../data/validators'
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
  ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  const body = await req.json().catch(() => ({}))
  const parsed = leaveTeamSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { teamId, competitionId } = parsed.data
  const customerUserId = ctx.auth?.sub ?? ''
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager

  // Find user's membership
  const membership = await em.findOne(TeamMember, {
    teamId,
    customerUserId,
    competitionId,
    deletedAt: null,
  } as FilterQuery<TeamMember>)

  if (!membership) {
    return NextResponse.json({ error: 'You are not a member of this team' }, { status: 404 })
  }

  const isOwner = membership.role === TeamRole.OWNER
  const now = new Date()

  await em.transactional(async () => {
    membership.leftAt = now
    membership.deletedAt = now
    await em.flush()
  })

  // If owner leaving, transfer ownership to the longest-standing remaining member
  if (isOwner) {
    const knex = em.getKnex()
    const nextOwner = await knex('teams_team_member')
      .where({
        team_id: teamId,
        deleted_at: null,
      })
      .whereNot({ customer_user_id: customerUserId })
      .orderBy('joined_at', 'asc')
      .first()

    if (nextOwner) {
      await knex('teams_team_member')
        .where({ id: nextOwner.id })
        .update({ role: TeamRole.OWNER })
    }
    // If no remaining members, the team becomes empty — it stays as-is
  }

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
      wasOwner: isOwner,
      tenantId: membership.tenantId,
      organizationId: membership.organizationId,
    }

    if (typeof eventBus.emit === 'function') {
      await eventBus.emit('teams.member.left', eventPayload)
    } else if (typeof eventBus.emitEvent === 'function') {
      await eventBus.emitEvent('teams.member.left', eventPayload)
    }
  } catch (err) {
    console.warn('[teams] Failed to emit member.left event', {
      teamId,
      customerUserId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return NextResponse.json({ ok: true })
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

export const openApi: OpenApiRouteDoc = {
  POST: {
    summary: 'Leave a team',
    description:
      'Removes the current user from a team. If the leaving member is the owner, ' +
      'ownership transfers to the longest-standing remaining member.',
    tags: [teamsTag],
    requestBody: {
      required: true,
      content: {
        'application/json': { schema: leaveTeamSchema },
      },
    },
    responses: {
      200: {
        description: 'Left the team',
        content: { 'application/json': { schema: okSchema } },
      },
      400: {
        description: 'Invalid request body',
        content: { 'application/json': { schema: errorSchema } },
      },
      404: {
        description: 'Not a member of this team',
        content: { 'application/json': { schema: errorSchema } },
      },
    },
  },
}
