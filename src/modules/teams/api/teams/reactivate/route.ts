import { NextResponse, type NextRequest } from 'next/server'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'

import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { AuthContext } from '@open-mercato/shared/lib/auth/server'
import { Team, TeamStatus } from '../../../data/entities'
import { reactivateTeamSchema } from '../../../data/validators'
import { teamsTag, okSchema, errorSchema } from '../../openapi'

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
  const parsed = reactivateTeamSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { teamId } = parsed.data
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager

  const team = await em.findOne(Team, {
    id: teamId,
    deletedAt: null,
  } as FilterQuery<Team>)

  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 })
  }

  if (team.status === TeamStatus.ACTIVE) {
    return NextResponse.json({ error: 'Team is already active' }, { status: 422 })
  }

  await em.transactional(async () => {
    team.status = TeamStatus.ACTIVE
    team.disqualificationReason = null
    team.disqualifiedAt = null
    team.disqualifiedBy = null
    team.updatedAt = new Date()
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
      competitionId: team.competitionId,
      tenantId: team.tenantId,
      organizationId: team.organizationId,
    }

    if (typeof eventBus.emit === 'function') {
      await eventBus.emit('teams.team.updated', eventPayload)
    } else if (typeof eventBus.emitEvent === 'function') {
      await eventBus.emitEvent('teams.team.updated', eventPayload)
    }
  } catch (err) {
    console.warn('[teams] Failed to emit reactivation event', {
      teamId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return NextResponse.json({
    ok: true,
    team: {
      id: team.id,
      status: team.status,
      updatedAt: team.updatedAt.toISOString(),
    },
  })
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

export const openApi: OpenApiRouteDoc = {
  POST: {
    summary: 'Reactivate a team',
    description: 'Sets a disqualified or withdrawn team back to ACTIVE status.',
    tags: [teamsTag],
    requestBody: {
      required: true,
      content: {
        'application/json': { schema: reactivateTeamSchema },
      },
    },
    responses: {
      200: {
        description: 'Team reactivated',
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
        description: 'Team is already active',
        content: { 'application/json': { schema: errorSchema } },
      },
    },
  },
}
