import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Competition, CompetitionStage as CompetitionStageValues, STAGE_ORDER } from '../../data/entities'
import type { CompetitionStage } from '../../data/entities'
import { Team, TeamStatus, TeamTrack } from '../../../teams/data/entities'
import { teamsMissingTrack } from '../../lib/stages'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const advanceStageSchema = z.object({
  competition_id: z.string().uuid(),
  target_stage: z.string(),
  /**
   * Proceed despite a preflight warning. The organiser has to have been shown the
   * warning first — the back-office lists the affected teams before re-sending.
   */
  acknowledge_warnings: z.boolean().optional(),
})

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['competitions.stages.manage'] },
}

export async function POST(request: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }

    const body = await request.json()
    const parsed = advanceStageSchema.parse(body)
    const em = container.resolve('em') as EntityManager

    const competition = await em.findOne(Competition, {
      id: parsed.competition_id,
      tenantId: auth.tenantId,
      organizationId: auth.orgId,
      deletedAt: null,
    } as FilterQuery<Competition>)

    if (!competition) {
      return new Response(JSON.stringify({ error: 'Competition not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
    }

    const currentIdx = STAGE_ORDER.indexOf(competition.stage)
    const targetIdx = STAGE_ORDER.indexOf(parsed.target_stage as CompetitionStage)

    if (targetIdx < 0) {
      return new Response(JSON.stringify({ error: `Invalid target stage: ${parsed.target_stage}` }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    if (targetIdx <= currentIdx) {
      return new Response(JSON.stringify({ error: `Cannot move from ${competition.stage} to ${parsed.target_stage}. Target must be a later stage.` }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    // Preflight: entering `hacking` creates one draft project per team per assigned
    // track, so a team with no track gets nothing and — because track selection
    // closes at the same moment — can never fix it itself. Report those teams
    // instead of advancing silently.
    const warnings: { teams_without_track: Array<{ id: string; name: string }> } = { teams_without_track: [] }
    if (parsed.target_stage === CompetitionStageValues.HACKING) {
      const activeTeams = await em.find(Team, {
        competitionId: competition.id,
        status: TeamStatus.ACTIVE,
        tenantId: auth.tenantId,
        organizationId: competition.organizationId,
        deletedAt: null,
      } as FilterQuery<Team>)

      const teamTracks = await em.find(TeamTrack, {
        competitionId: competition.id,
        tenantId: auth.tenantId,
      } as FilterQuery<TeamTrack>)

      const trackIdsByTeam = new Map<string, string[]>()
      for (const entry of teamTracks) {
        const list = trackIdsByTeam.get(entry.teamId) ?? []
        list.push(entry.trackId)
        trackIdsByTeam.set(entry.teamId, list)
      }

      warnings.teams_without_track = teamsMissingTrack(activeTeams, trackIdsByTeam)
        .map((team) => ({ id: team.id, name: team.name }))

      if (warnings.teams_without_track.length > 0 && !parsed.acknowledge_warnings) {
        return new Response(JSON.stringify({
          error: `${warnings.teams_without_track.length} active team(s) have not selected a track and will get no project. Assign them a track, or confirm to advance without them.`,
          code: 'teams_without_track',
          warnings,
        }), { status: 409, headers: { 'content-type': 'application/json' } })
      }
    }

    const oldStage = competition.stage
    competition.stage = parsed.target_stage as CompetitionStage
    em.persist(competition)
    await em.flush()

    // Emit stage_advanced event for subscribers (lockdown, auto-create projects, etc.)
    const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
    await eventBus.emit('competitions.competition.stage_advanced', {
      competitionId: competition.id,
      oldStage,
      newStage: parsed.target_stage,
      advancedBy: auth.userId ?? auth.sub ?? null,
      tenantId: auth.tenantId,
      organizationId: competition.organizationId,
    })

    return new Response(JSON.stringify({
      ok: true,
      competition: {
        id: competition.id,
        stage: competition.stage,
        previousStage: oldStage,
      },
      // Non-empty only when the organiser acknowledged them: these teams advanced
      // without a track and will not receive a draft project.
      warnings,
    }), { headers: { 'content-type': 'application/json' } })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: error.issues }), { status: 422, headers: { 'content-type': 'application/json' } })
    }
    console.error('[advance-stage] POST error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Stage management',
  methods: {
    POST: { summary: 'Advance competition to next stage' },
  },
}
