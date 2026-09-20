import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { Competition, CompetitionStage } from '../../../../competitions/data/entities'
import { Project } from '../../../../projects/data/entities'
import { ensureDraftProjects, isUntouchedDraft } from '../../../../projects/lib/draftProjects'
import { Track } from '../../../../tracks/data/entities'
import { unavailableTrackIds } from '../../../../tracks/lib/track-visibility'
import { Team, TeamTrack } from '../../../data/entities'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['teams.edit'] },
}

const assignSchema = z.object({
  team_id: z.string().uuid(),
  track_ids: z.array(z.string().uuid()).max(20),
})

const TEAM_RESOURCE_KIND = 'teams:team'

/**
 * Organizer override for a team's tracks — not stage-gated, unlike the portal route.
 * Its reason to exist: a team formed during `hacking` missed the stage transition that
 * creates draft projects, so assigning a track here also creates the missing project.
 */
export async function POST(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId || !auth?.sub) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const requested = assignSchema.parse(await req.json())

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope.selectedId ?? auth.orgId
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
    }

    // ── Read phase ────────────────────────────────────────────────────
    const team = await em.findOne(Team, {
      id: requested.team_id,
      tenantId: auth.tenantId,
      organizationId,
      deletedAt: null,
    } as FilterQuery<Team>)
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

    const guard = await runRouteMutationGuards({
      container,
      req,
      auth: { userId: auth.sub, tenantId: auth.tenantId, organizationId },
      input: { resourceKind: TEAM_RESOURCE_KIND, resourceId: team.id, operation: 'update', mutationPayload: { ...requested } },
    })
    if (!guard.ok) return guard.response
    const parsed = guard.modifiedPayload ? assignSchema.parse({ ...requested, ...guard.modifiedPayload }) : requested
    const desiredTrackIds = [...new Set(parsed.track_ids)]

    const competition = await em.findOne(Competition, {
      id: team.competitionId,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<Competition>)
    if (!competition) return NextResponse.json({ error: 'Competition not found' }, { status: 404 })

    const maxTracks = competition.maxTracksPerTeam ?? 1
    if (desiredTrackIds.length > maxTracks) {
      return NextResponse.json({ error: `This competition allows at most ${maxTracks} track(s) per team` }, { status: 422 })
    }

    const currentEntries = await em.find(TeamTrack, { teamId: team.id, tenantId: auth.tenantId } as FilterQuery<TeamTrack>)
    const currentTrackIds = new Set(currentEntries.map((entry) => entry.trackId))
    if (team.trackId) currentTrackIds.add(team.trackId)

    if (desiredTrackIds.length > 0) {
      const tracks = await em.find(Track, {
        id: { $in: desiredTrackIds },
        competitionId: team.competitionId,
        tenantId: auth.tenantId,
      } as FilterQuery<Track>)
      if (tracks.length !== desiredTrackIds.length) {
        return NextResponse.json({ error: 'One or more tracks do not belong to this competition' }, { status: 404 })
      }
      // Only newly added tracks must be available: an organizer may keep a team on a
      // track that was deactivated after the team picked it.
      const added = desiredTrackIds.filter((trackId) => !currentTrackIds.has(trackId))
      const unavailable = unavailableTrackIds(added, new Map(tracks.map((track) => [track.id, track])))
      if (unavailable.length > 0) {
        return NextResponse.json({ error: `${unavailable.length} of the added track(s) are deactivated or deleted`, details: unavailable }, { status: 409 })
      }
    }

    // A removed track may already carry the team's work. Untouched drafts go with the
    // track; anything else blocks the change so nothing a team wrote disappears silently.
    const removedTrackIds = [...currentTrackIds].filter((trackId) => !desiredTrackIds.includes(trackId))
    const removedProjects = removedTrackIds.length > 0
      ? await em.find(Project, {
          teamId: team.id,
          competitionId: team.competitionId,
          trackId: { $in: removedTrackIds },
          tenantId: auth.tenantId,
          deletedAt: null,
        } as FilterQuery<Project>)
      : []
    const blocking = removedProjects.filter((project) => !isUntouchedDraft(project))
    if (blocking.length > 0) {
      return NextResponse.json({
        error: 'The team already has project work on a track you are removing. Delete or move that project first.',
        details: blocking.map((project) => ({ project_id: project.id, track_id: project.trackId, title: project.title, status: project.status })),
      }, { status: 409 })
    }

    // Draft projects normally appear at the `hacking` transition. A team that got its
    // track afterwards needs them now; before `hacking` the transition will do it, and
    // after it a fresh draft could not be submitted anyway.
    const createsDrafts = competition.stage === CompetitionStage.HACKING
    // Last read (inside): must stay ahead of every scalar mutation below.
    const drafts = createsDrafts ? await ensureDraftProjects(em, team, desiredTrackIds) : []

    // ── Write phase (no finds from here to the flush) ─────────────────
    for (const entry of currentEntries) {
      if (!desiredTrackIds.includes(entry.trackId)) em.remove(entry)
    }
    const junctionTrackIds = new Set(currentEntries.map((entry) => entry.trackId))
    for (const trackId of desiredTrackIds) {
      if (junctionTrackIds.has(trackId)) continue
      em.persist(em.create(TeamTrack, {
        teamId: team.id,
        trackId,
        competitionId: team.competitionId,
        tenantId: auth.tenantId,
        organizationId: team.organizationId,
        createdAt: new Date(),
      }))
    }
    for (const project of removedProjects) em.remove(project)

    team.trackId = desiredTrackIds[0] ?? null
    team.updatedAt = new Date()
    em.persist(team)
    await em.flush()

    // ── After commit ──────────────────────────────────────────────────
    await guard.runAfterSuccess()
    try {
      const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
      await eventBus.emit('teams.team.tracks_updated', {
        teamId: team.id,
        trackIds: desiredTrackIds,
        competitionId: team.competitionId,
        tenantId: auth.tenantId,
        organizationId: team.organizationId,
      })
    } catch (e) {
      console.error('[teams/admin/assign-tracks] Event emit error:', e)
    }

    return NextResponse.json({
      ok: true,
      team_id: team.id,
      track_ids: desiredTrackIds,
      created_project_ids: drafts.map((project) => project.id),
      removed_project_ids: removedProjects.map((project) => project.id),
      drafts_created_for_stage: createsDrafts,
      stage: competition.stage,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[teams/admin/assign-tracks] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Teams',
  summary: 'Assign tracks to a team (organizer)',
  methods: {
    POST: { summary: 'Set the tracks of a team at any stage; during hacking also creates the missing draft projects' },
  },
}
