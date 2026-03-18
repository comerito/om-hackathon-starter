import { NextResponse, type NextRequest } from 'next/server'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'

import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { AuthContext } from '@open-mercato/shared/lib/auth/server'
import { Team, TeamStatus } from '../../../data/entities'
import { disqualifyTeamSchema } from '../../../data/validators'
import { teamsTag, okSchema, errorSchema } from '../../openapi'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['teams.disqualify'] },
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  const body = await req.json().catch(() => ({}))
  const parsed = disqualifyTeamSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { teamId, reason } = parsed.data
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager

  const team = await em.findOne(Team, {
    id: teamId,
    deletedAt: null,
  } as FilterQuery<Team>)

  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 })
  }

  if (team.status === TeamStatus.DISQUALIFIED) {
    return NextResponse.json({ error: 'Team is already disqualified' }, { status: 422 })
  }

  const now = new Date()
  const adminId = ctx.auth?.sub ?? null

  await em.transactional(async () => {
    team.status = TeamStatus.DISQUALIFIED
    team.disqualificationReason = reason
    team.disqualifiedAt = now
    team.disqualifiedBy = adminId
    team.updatedAt = now
    await em.flush()
  })

  // Emit event
  try {
    const eventBus = container.resolve('eventBus') as {
      emit?: (event: string, payload: unknown) => Promise<void>
      emitEvent?: (event: string, payload: unknown) => Promise<void>
    }

    const eventPayload = {
      teamId: team.id,
      reason,
      competitionId: team.competitionId,
      disqualifiedBy: adminId,
      tenantId: team.tenantId,
      organizationId: team.organizationId,
    }

    if (typeof eventBus.emit === 'function') {
      await eventBus.emit('teams.team.disqualified', eventPayload)
    } else if (typeof eventBus.emitEvent === 'function') {
      await eventBus.emitEvent('teams.team.disqualified', eventPayload)
    }
  } catch (err) {
    console.warn('[teams] Failed to emit disqualified event', {
      teamId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return NextResponse.json({
    ok: true,
    team: {
      id: team.id,
      status: team.status,
      disqualificationReason: team.disqualificationReason,
      disqualifiedAt: team.disqualifiedAt?.toISOString() ?? null,
    },
  })
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

export const openApi: OpenApiRouteDoc = {
  POST: {
    summary: 'Disqualify a team',
    description: 'Sets team status to DISQUALIFIED with reason, timestamp, and admin who performed the action.',
    tags: [teamsTag],
    requestBody: {
      required: true,
      content: {
        'application/json': { schema: disqualifyTeamSchema },
      },
    },
    responses: {
      200: {
        description: 'Team disqualified',
        content: { 'application/json': { schema: okSchema } },
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
        description: 'Team already disqualified',
        content: { 'application/json': { schema: errorSchema } },
      },
    },
  },
}
