import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { JudgePanelJudge, JudgePanelTrack, JudgePanel, ProjectScore } from '../../../data/entities'
import { Project } from '../../../../projects/data/entities'
import { Team } from '../../../../teams/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { applyPortalTranslationOverlays, resolvePortalLocale } from '@/lib/portal-translations'

export const metadata = { GET: { requireCustomerAuth: true } }

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    if (!competitionId) return NextResponse.json({ error: 'competition_id required' }, { status: 400 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const locale = resolvePortalLocale(req)

    // Find panels this judge is on
    const panelJudges = await em.find(JudgePanelJudge, {
      judgeId: auth.sub, tenantId: auth.tenantId, organizationId: auth.orgId,
    } as FilterQuery<JudgePanelJudge>)

    if (!panelJudges.length) {
      return NextResponse.json({ panels: [], projects: [], scores: [] })
    }

    const panelIds = panelJudges.map(pj => pj.panelId)
    const panels = await em.find(JudgePanel, {
      id: { $in: panelIds }, competitionId, deletedAt: null, organizationId: auth.orgId,
    } as FilterQuery<JudgePanel>)

    // Find tracks assigned to these panels
    const panelTracks = await em.find(JudgePanelTrack, {
      panelId: { $in: panelIds },
    } as FilterQuery<JudgePanelTrack>)
    const trackIds = [...new Set(panelTracks.map(pt => pt.trackId))]

    // Find published projects in those tracks
    const projects = trackIds.length ? await em.find(Project, {
      competitionId, trackId: { $in: trackIds },
      status: { $ne: 'draft' }, deletedAt: null, tenantId: auth.tenantId,
    } as FilterQuery<Project>) : []

    // Get teams
    const teamIds = [...new Set(projects.map(p => p.teamId))]
    const teams = teamIds.length ? await em.find(Team, { id: { $in: teamIds } } as FilterQuery<Team>) : []
    const teamMap = new Map(teams.map(t => [t.id, t.name]))

    // Get this judge's existing scores
    const projectIds = projects.map(p => p.id)
    const scores = projectIds.length ? await em.find(ProjectScore, {
      judgeId: auth.sub, projectId: { $in: projectIds },
    } as FilterQuery<ProjectScore>) : []
    const scoreMap = new Map(scores.map(s => [s.projectId + ':' + s.round, s]))

    const translatedProjects = await applyPortalTranslationOverlays(
      projects.map(p => ({
        id: p.id, title: p.title, tagline: p.tagline, team_id: p.teamId,
        team_name: teamMap.get(p.teamId) ?? null, track_id: p.trackId,
        status: p.status, flagged_for_reuse: p.flaggedForReuse,
        uses_preexisting_code: p.usesPreexistingCode,
        description: p.description, demo_url: p.demoUrl, repo_url: p.repoUrl,
        video_url: p.videoUrl, tech_stack: p.techStack,
      })),
      {
        entityType: 'projects:project',
        locale,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
        container,
      },
    )

    return NextResponse.json({
      panels: panels.map(p => ({ id: p.id, name: p.name, round: p.round })),
      projects: translatedProjects,
      scores: scores.map(s => ({
        id: s.id, project_id: s.projectId, round: s.round,
        total_score: s.totalScore, is_submitted: s.isSubmitted,
        conflict_of_interest: s.conflictOfInterest,
      })),
    })
  } catch (error) {
    console.error('[portal/my-assignments] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal', summary: 'Judge assignments',
  methods: { GET: { summary: 'Get assigned projects and scoring status for current judge' } },
}
