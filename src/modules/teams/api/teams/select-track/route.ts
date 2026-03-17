import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { AuthContext } from '@open-mercato/shared/lib/auth/server'
import { Team, TeamStatus } from '../../../data/entities'
import { Track } from '../../../../tracks/data/entities'
import { selectTrackSchema } from '../../../data/validators'
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
  const parsed = selectTrackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { teamId, trackId } = parsed.data
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

  // Load track
  const track = await em.findOne(Track, {
    id: trackId,
    competitionId: team.competitionId,
    isActive: true,
  } as FilterQuery<Track>)

  if (!track) {
    return NextResponse.json({ error: 'Track not found or inactive' }, { status: 404 })
  }

  // Check track capacity if maxTeams is set
  if (track.maxTeams != null) {
    const currentTeamCount = await em.count(Team, {
      trackId,
      competitionId: team.competitionId,
      status: TeamStatus.ACTIVE,
      deletedAt: null,
    } as FilterQuery<Team>)

    // Exclude current team if it was already on this track
    const effectiveCount = team.trackId === trackId ? currentTeamCount - 1 : currentTeamCount
    if (effectiveCount >= track.maxTeams) {
      return NextResponse.json({ error: 'Track is full' }, { status: 422 })
    }
  }

  // Update team track
  await withAtomicFlush(
    em,
    [
      () => {
        team.trackId = trackId
        team.updatedAt = new Date()
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
      teamId: team.id,
      trackId,
      competitionId: team.competitionId,
      tenantId: team.tenantId,
      organizationId: team.organizationId,
    }

    if (typeof eventBus.emit === 'function') {
      await eventBus.emit('teams.team.track_selected', eventPayload)
    } else if (typeof eventBus.emitEvent === 'function') {
      await eventBus.emitEvent('teams.team.track_selected', eventPayload)
    }
  } catch (err) {
    console.warn('[teams] Failed to emit track_selected event', {
      teamId,
      trackId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return NextResponse.json({
    ok: true,
    team: {
      id: team.id,
      trackId: team.trackId,
      updatedAt: team.updatedAt.toISOString(),
    },
  })
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

export const openApi: OpenApiRouteDoc = {
  POST: {
    summary: 'Select a track for a team',
    description: 'Assigns the team to a track. Validates track exists and has capacity.',
    tags: [teamsTag],
    requestBody: {
      required: true,
      content: {
        'application/json': { schema: selectTrackSchema },
      },
    },
    responses: {
      200: {
        description: 'Track selected',
        content: { 'application/json': { schema: okSchema } },
      },
      400: {
        description: 'Invalid request body',
        content: { 'application/json': { schema: errorSchema } },
      },
      404: {
        description: 'Team or track not found',
        content: { 'application/json': { schema: errorSchema } },
      },
      422: {
        description: 'Track is full',
        content: { 'application/json': { schema: errorSchema } },
      },
    },
  },
}
