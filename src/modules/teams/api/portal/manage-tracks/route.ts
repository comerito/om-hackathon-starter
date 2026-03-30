import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Team, TeamMember, TeamRole, TeamTrack } from '../../../data/entities'
import { Track } from '../../../../tracks/data/entities'
import { Competition, CompetitionStage, STAGE_ORDER } from '../../../../competitions/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const manageTracksSchema = z.object({
  team_id: z.string().uuid(),
  track_ids: z.array(z.string().uuid()),
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
    const parsed = manageTracksSchema.parse(body)
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
      return NextResponse.json({ error: 'Only the team owner can manage tracks' }, { status: 403 })
    }

    const team = await em.findOne(Team, {
      id: parsed.team_id,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<Team>)
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Load competition for config and stage gating
    const competition = await em.findOne(Competition, {
      id: team.competitionId,
      tenantId: auth.tenantId,
    } as FilterQuery<Competition>)
    if (!competition) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
    }

    // Stage gating — allow during team_formation and track_selection; after that only with allowTrackChange
    const stageIdx = STAGE_ORDER.indexOf(competition.stage)
    const teamFormationIdx = STAGE_ORDER.indexOf(CompetitionStage.TEAM_FORMATION)
    const trackSelectionIdx = STAGE_ORDER.indexOf(CompetitionStage.TRACK_SELECTION)

    if (stageIdx < teamFormationIdx) {
      return NextResponse.json({ error: 'Track selection has not started yet' }, { status: 403 })
    } else if (stageIdx > trackSelectionIdx) {
      if (!competition.allowTrackChange) {
        return NextResponse.json({ error: 'Track selection is closed. Track changes are not allowed.' }, { status: 403 })
      }
    }

    // Validate track count against maxTracksPerTeam
    const maxTracks = competition.maxTracksPerTeam ?? 1
    if (parsed.track_ids.length > maxTracks) {
      return NextResponse.json({ error: `Maximum ${maxTracks} track(s) allowed per team` }, { status: 422 })
    }

    // Validate all tracks belong to this competition
    if (parsed.track_ids.length > 0) {
      const tracks = await em.find(Track, {
        id: { $in: parsed.track_ids },
        competitionId: team.competitionId,
        tenantId: auth.tenantId,
      } as FilterQuery<Track>)
      if (tracks.length !== parsed.track_ids.length) {
        return NextResponse.json({ error: 'One or more tracks not found in this competition' }, { status: 404 })
      }
    }

    // Sync junction table: find current, diff, insert/delete
    const currentEntries = await em.find(TeamTrack, {
      teamId: team.id,
    } as FilterQuery<TeamTrack>)
    const currentTrackIds = new Set(currentEntries.map(e => e.trackId))
    const desiredTrackIds = new Set(parsed.track_ids)

    // Delete removed tracks
    for (const entry of currentEntries) {
      if (!desiredTrackIds.has(entry.trackId)) {
        em.remove(entry)
      }
    }

    // Insert new tracks
    for (const trackId of parsed.track_ids) {
      if (!currentTrackIds.has(trackId)) {
        em.persist(em.create(TeamTrack, {
          teamId: team.id,
          trackId,
          competitionId: team.competitionId,
          tenantId: auth.tenantId,
          organizationId: auth.orgId,
          createdAt: new Date(),
        }))
      }
    }

    // Update deprecated Team.trackId for backward compat
    team.trackId = parsed.track_ids[0] ?? null
    em.persist(team)

    await em.flush()

    // Emit event
    try {
      const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
      await eventBus.emit('teams.team.tracks_updated', {
        teamId: team.id,
        trackIds: parsed.track_ids,
        competitionId: team.competitionId,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
      })
    } catch (e) {
      console.error('[portal/manage-tracks] Event emit error:', e)
    }

    return NextResponse.json({ ok: true, track_ids: parsed.track_ids })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[portal/manage-tracks] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Manage team tracks',
  methods: { POST: { summary: 'Set the tracks for a team (multi-track support)' } },
}
