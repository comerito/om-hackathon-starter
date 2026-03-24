import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Team, TeamStatus } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const disqualifySchema = z.object({
  team_id: z.string().uuid(),
  reason: z.string().min(1),
})

const reactivateSchema = z.object({
  team_id: z.string().uuid(),
})

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['teams.disqualify'] },
  PUT: { requireAuth: true, requireFeatures: ['teams.manage'] },
}

export async function POST(request: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }

    const body = await request.json()
    const parsed = disqualifySchema.parse(body)
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

    team.status = TeamStatus.DISQUALIFIED
    team.disqualificationReason = parsed.reason
    team.disqualifiedAt = new Date()
    team.disqualifiedBy = auth.userId ?? auth.sub ?? null
    await em.persistAndFlush(team)

    const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
    await eventBus.emit('teams.team.disqualified', {
      teamId: team.id,
      competitionId: team.competitionId,
      reason: parsed.reason,
      disqualifiedBy: team.disqualifiedBy,
      tenantId: auth.tenantId,
      organizationId: team.organizationId,
    })

    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: error.issues }), { status: 422, headers: { 'content-type': 'application/json' } })
    }
    console.error('[disqualify] POST error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

// Reactivate team
export async function PUT(request: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }

    const body = await request.json()
    const parsed = reactivateSchema.parse(body)
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

    if (team.status === TeamStatus.ACTIVE) {
      return new Response(JSON.stringify({ error: 'Team is already active' }), { status: 422, headers: { 'content-type': 'application/json' } })
    }

    team.status = TeamStatus.ACTIVE
    team.disqualificationReason = null
    team.disqualifiedAt = null
    team.disqualifiedBy = null
    await em.persistAndFlush(team)

    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: error.issues }), { status: 422, headers: { 'content-type': 'application/json' } })
    }
    console.error('[disqualify] PUT error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Teams',
  summary: 'Team disqualification',
  methods: {
    POST: { summary: 'Disqualify a team' },
    PUT: { summary: 'Reactivate a disqualified/withdrawn team' },
  },
}
