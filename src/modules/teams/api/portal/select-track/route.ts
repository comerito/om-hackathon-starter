import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Team, TeamMember, TeamRole, TeamTrack } from '../../../data/entities'
import { Track } from '../../../../tracks/data/entities'
import { Competition, CompetitionStage, STAGE_ORDER } from '../../../../competitions/data/entities'
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

    // Enforce competition stage — track selection only allowed during permitted windows
    const competition = await em.findOne(Competition, {
      id: team.competitionId,
      tenantId: auth.tenantId,
    } as FilterQuery<Competition>)
    if (!competition) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
    }

    const stageIdx = STAGE_ORDER.indexOf(competition.stage)
    const teamFormationIdx = STAGE_ORDER.indexOf(CompetitionStage.TEAM_FORMATION)
    const trackSelectionIdx = STAGE_ORDER.indexOf(CompetitionStage.TRACK_SELECTION)

    if (stageIdx < teamFormationIdx) {
      return NextResponse.json({ error: 'Track selection has not started yet' }, { status: 403 })
    } else if (stageIdx > trackSelectionIdx) {
      // After track selection — only allow if allowTrackChange is true
      if (!competition.allowTrackChange) {
        return NextResponse.json({ error: 'Track selection is closed. Track changes are not allowed.' }, { status: 403 })
      }
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

    // Sync junction table: clear existing, add new if non-null
    const existingEntries = await em.find(TeamTrack, { teamId: team.id } as FilterQuery<TeamTrack>)
    for (const entry of existingEntries) {
      em.remove(entry)
    }
    if (parsed.track_id) {
      em.persist(em.create(TeamTrack, {
        teamId: team.id,
        trackId: parsed.track_id,
        competitionId: team.competitionId,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
        createdAt: new Date(),
      }))
    }

    await em.flush()

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
