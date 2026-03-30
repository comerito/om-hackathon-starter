import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { Project } from '../../../data/entities'
import { TeamMember } from '../../../../teams/data/entities'
import { Team } from '../../../../teams/data/entities'
import { Track } from '../../../../tracks/data/entities'
import { Competition } from '../../../../competitions/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { applyPortalTranslationOverlays, resolvePortalLocale } from '@/lib/portal-translations'

export const metadata = {
  GET: { requireCustomerAuth: true },
}

function serializeProject(project: Project) {
  return {
    id: project.id,
    title: project.title,
    tagline: project.tagline ?? null,
    description: project.description ?? null,
    problem_statement: project.problemStatement ?? null,
    solution: project.solution ?? null,
    tech_stack: project.techStack,
    demo_url: project.demoUrl ?? null,
    repo_url: project.repoUrl ?? null,
    video_url: project.videoUrl ?? null,
    presentation_url: project.presentationUrl ?? null,
    screenshot_ids: project.screenshotIds,
    attachment_ids: project.attachmentIds,
    uses_preexisting_code: project.usesPreexistingCode,
    preexisting_code_description: project.preexistingCodeDescription ?? null,
    built_during_hackathon_description: project.builtDuringHackathonDescription ?? null,
    flagged_for_reuse: project.flaggedForReuse,
    flagged_reason: project.flaggedReason ?? null,
    status: project.status,
    submitted_at: project.submittedAt ?? null,
    track_id: project.trackId,
    team_id: project.teamId,
    competition_id: project.competitionId,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  }
}

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    if (!competitionId) {
      return NextResponse.json({ error: 'competition_id is required' }, { status: 400 })
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const locale = resolvePortalLocale(req)

    // Find user's team membership
    const membership = await em.findOne(TeamMember, {
      customerUserId: auth.sub,
      competitionId,
      deletedAt: null,
    } as FilterQuery<TeamMember>)

    if (!membership) {
      return NextResponse.json({ project: null, projects: [], team: null, hasTeam: false })
    }

    // Find the team
    const team = await em.findOne(Team, {
      id: membership.teamId,
      deletedAt: null,
    } as FilterQuery<Team>)

    if (!team) {
      return NextResponse.json({ project: null, projects: [], team: null, hasTeam: false })
    }

    // Find ALL projects for this team in this competition
    const projects = await em.find(Project, {
      teamId: team.id,
      competitionId,
      deletedAt: null,
    } as FilterQuery<Project>)

    // Collect all track IDs from projects and resolve their names
    const trackIds = [...new Set(projects.map(p => p.trackId).filter(Boolean))]
    const trackMap = new Map<string, { name: string; color: string }>()
    if (trackIds.length > 0) {
      const tracks = await em.find(Track, { id: { $in: trackIds } } as FilterQuery<Track>)
      const translatedTracks = await applyPortalTranslationOverlays(
        tracks.map(t => ({ id: t.id, name: t.name, color: t.color })),
        {
          entityType: 'tracks:track',
          locale,
          tenantId: auth.tenantId,
          organizationId: auth.orgId,
          container,
        },
      )
      for (const t of translatedTracks) {
        trackMap.set(t.id, { name: t.name, color: t.color })
      }
    }

    // Also resolve team's trackId if not already in map
    if (team.trackId && !trackMap.has(team.trackId)) {
      const track = await em.findOne(Track, { id: team.trackId })
      if (track) {
        const [translatedTrack] = await applyPortalTranslationOverlays(
          [{ id: track.id, name: track.name, color: track.color }],
          {
            entityType: 'tracks:track',
            locale,
            tenantId: auth.tenantId,
            organizationId: auth.orgId,
            container,
          },
        )
        trackMap.set(track.id, { name: translatedTrack?.name ?? track.name, color: track.color })
      }
    }

    const comp = await em.findOne(Competition, { id: competitionId } as FilterQuery<Competition>)
    const submissionDeadline = comp?.projectSubmissionDeadline ?? null

    const serializedProjects = await applyPortalTranslationOverlays(
      projects.map(serializeProject),
      {
        entityType: 'projects:project',
        locale,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
        container,
      },
    )
    const firstProject = serializedProjects[0] ?? null
    const trackName = firstProject ? (trackMap.get(firstProject.track_id)?.name ?? null) : null

    return NextResponse.json({
      // Backward compat: single project (first one)
      project: firstProject,
      // New: all projects
      projects: serializedProjects,
      team: {
        id: team.id,
        name: team.name,
        track_id: team.trackId ?? null,
      },
      tracks: Array.from(trackMap.entries()).map(([id, t]) => ({ id, name: t.name, color: t.color })),
      trackName,
      submissionDeadline: submissionDeadline ? submissionDeadline.toISOString() : null,
      hasTeam: true,
      isOwner: membership.role === 'owner',
    })
  } catch (error) {
    console.error('[portal/my-project] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'My project',
  methods: { GET: { summary: 'Get the current user\'s team project(s)' } },
}
