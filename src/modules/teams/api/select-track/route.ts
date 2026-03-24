import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Team } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const selectTrackSchema = z.object({
  team_id: z.string().uuid(),
  track_id: z.string().uuid(),
})

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['teams.edit'] },
}

export async function POST(request: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }

    const body = await request.json()
    const parsed = selectTrackSchema.parse(body)
    const em = container.resolve('em') as EntityManager

    const team = await em.findOne(Team, {
      id: parsed.team_id,
      tenantId: auth.tenantId,
      organizationId: auth.orgId,
      deletedAt: null,
    } as FilterQuery<Team>)

    if (!team) {
      return new Response(JSON.stringify({ error: 'Team not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
    }

    team.trackId = parsed.track_id
    await em.persistAndFlush(team)

    // Emit track_selected event
    const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
    await eventBus.emit('teams.team.track_selected', {
      teamId: team.id,
      trackId: parsed.track_id,
      competitionId: team.competitionId,
      tenantId: auth.tenantId,
      organizationId: team.organizationId,
    })

    return new Response(JSON.stringify({ ok: true, teamId: team.id, trackId: parsed.track_id }), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: error.issues }), { status: 422, headers: { 'content-type': 'application/json' } })
    }
    console.error('[select-track] POST error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Teams',
  summary: 'Track selection',
  methods: {
    POST: { summary: 'Select track for a team' },
  },
}
