import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Team, TeamMember, TeamRole } from '../../../data/entities'
import { Track } from '../../../../tracks/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const selectTrackSchema = z.object({
  team_id: z.string().uuid(),
  track_id: z.string().uuid().nullable(),
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
    const parsed = selectTrackSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Verify caller is team owner
    const ownership = await em.findOne(TeamMember, {
      teamId: parsed.team_id,
      customerUserId: auth.sub,
      role: TeamRole.OWNER,
      deletedAt: null,
      tenantId: auth.tenantId,
    } as FilterQuery<TeamMember>)
    if (!ownership) {
      return NextResponse.json({ error: 'Only the team owner can select a track' }, { status: 403 })
    }

    const team = await em.findOne(Team, {
      id: parsed.team_id,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<Team>)
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Verify track belongs to same competition (if not null)
    if (parsed.track_id) {
      const track = await em.findOne(Track, {
        id: parsed.track_id,
        competitionId: team.competitionId,
        tenantId: auth.tenantId,
      } as FilterQuery<Track>)
      if (!track) {
        return NextResponse.json({ error: 'Track not found in this competition' }, { status: 404 })
      }
    }

    team.trackId = parsed.track_id
    await em.persistAndFlush(team)

    return NextResponse.json({ ok: true, track_id: parsed.track_id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[portal/select-track] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Select track (portal)',
  methods: { POST: { summary: 'Team owner selects a track for their team' } },
}
