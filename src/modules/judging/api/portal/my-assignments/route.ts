import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import {
  CriterionScore, DemoSession, JudgePanelJudge, JudgePanelTrack, JudgePanel, JudgingCriterion, JudgingRound, ProjectScore,
} from '../../../data/entities'
import type { DemoStatus } from '../../../data/entities'
import { Project } from '../../../../projects/data/entities'
import { Team } from '../../../../teams/data/entities'
import { Track } from '../../../../tracks/data/entities'
import { Competition } from '../../../../competitions/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { applyPortalTranslationOverlays, resolvePortalLocale } from '@/lib/portal-translations'
import { PORTAL_VIEW_ASSIGNED_FEATURE, requirePortalFeatures } from '../../../lib/portalAuth'
import { areResultsPublished } from '../../../lib/resultsScope'
import { computeScore, isLegacySubmitted, resolveApplicableCriteria } from '../../../lib/scoring'
import { sortByDemoOrder } from '../../../lib/votingQueue'

// NOTE: `requireCustomerAuth` / `requireCustomerFeatures` are NOT enforced for API routes —
// see `lib/portalAuth.ts`. The enforcement lives in the handler below.
export const metadata = {
  GET: { requireCustomerAuth: true, requireCustomerFeatures: [PORTAL_VIEW_ASSIGNED_FEATURE] },
}

/** Every portal judging surface is hard-wired to the preliminary round (SPEC-007 → Round). */
const QUEUE_ROUND = JudgingRound.PRELIMINARY

/** Same URL shape as `projects/api/portal/my-project`; the asset route already entitles judges. */
function buildPortalAssetUrl(attachmentId: string): string {
  return `/api/projects/portal/asset-file/${encodeURIComponent(attachmentId)}`
}

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const forbidden = requirePortalFeatures(auth, [PORTAL_VIEW_ASSIGNED_FEATURE])
    if (forbidden) return forbidden

    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    if (!competitionId) return NextResponse.json({ error: 'competition_id required' }, { status: 400 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const locale = await resolvePortalLocale(req, { auth, container })

    // The competition must exist in the caller's own tenant + organisation. An unknown id gets
    // the same empty assignment set as a judge without panels, with voting closed.
    const competition = await em.findOne(Competition, {
      id: competitionId, tenantId: auth.tenantId, organizationId: auth.orgId, deletedAt: null,
    } as FilterQuery<Competition>)
    const votingOpen = competition ? !areResultsPublished(competition.stage) : false
    const emptyResponse = () => NextResponse.json({ panels: [], projects: [], scores: [], voting_open: votingOpen })
    if (!competition) return emptyResponse()

    // Find panels this judge is on
    const panelJudges = await em.find(JudgePanelJudge, {
      judgeId: auth.sub, tenantId: auth.tenantId, organizationId: auth.orgId,
    } as FilterQuery<JudgePanelJudge>)

    if (!panelJudges.length) return emptyResponse()

    const panelIds = panelJudges.map(pj => pj.panelId)
    const panels = await em.find(JudgePanel, {
      id: { $in: panelIds }, competitionId, tenantId: auth.tenantId,
      deletedAt: null, organizationId: auth.orgId,
    } as FilterQuery<JudgePanel>)
    // Only the panels that belong to THIS competition may contribute assignments. Using every
    // panel the judge sits on pulled in the tracks of another competition's panel, so a judge
    // who serves two events was offered projects from the wrong one.
    const competitionPanelIds = panels.map(p => p.id)
    if (!competitionPanelIds.length) return emptyResponse()

    // Find tracks assigned to those panels
    const panelTracks = await em.find(JudgePanelTrack, {
      panelId: { $in: competitionPanelIds },
      tenantId: auth.tenantId, organizationId: auth.orgId,
    } as FilterQuery<JudgePanelTrack>)
    const trackIds = [...new Set(panelTracks.map(pt => pt.trackId))]

    // Find published projects in those tracks
    const projects = trackIds.length ? await em.find(Project, {
      competitionId, trackId: { $in: trackIds },
      status: { $ne: 'draft' }, deletedAt: null,
      tenantId: auth.tenantId, organizationId: auth.orgId,
    } as FilterQuery<Project>) : []

    // Get teams
    const teamIds = [...new Set(projects.map(p => p.teamId))]
    const teams = teamIds.length ? await em.find(Team, {
      id: { $in: teamIds }, tenantId: auth.tenantId, organizationId: auth.orgId,
    } as FilterQuery<Team>) : []
    const teamMap = new Map(teams.map(t => [t.id, t.name]))

    // Track names for the project card
    const projectTrackIds = [...new Set(projects.map(p => p.trackId))]
    const tracks = projectTrackIds.length ? await em.find(Track, {
      id: { $in: projectTrackIds }, tenantId: auth.tenantId, organizationId: auth.orgId, deletedAt: null,
    } as FilterQuery<Track>) : []
    const translatedTracks = await applyPortalTranslationOverlays(
      tracks.map(t => ({ id: t.id, name: t.name })),
      { entityType: 'tracks:track', locale, tenantId: auth.tenantId, organizationId: auth.orgId, container },
    )
    const trackNameMap = new Map(translatedTracks.map(t => [t.id, t.name]))

    const projectIds = projects.map(p => p.id)

    // Demo slots of the queue round, for this competition only
    const demos = projectIds.length ? await em.find(DemoSession, {
      competitionId, round: QUEUE_ROUND, projectId: { $in: projectIds },
      tenantId: auth.tenantId, organizationId: auth.orgId,
    } as FilterQuery<DemoSession>) : []
    const demoMap = new Map<string, { order: number; status: DemoStatus }>()
    for (const demo of demos) {
      const existing = demoMap.get(demo.projectId)
      if (!existing || demo.presentationOrder < existing.order) {
        demoMap.set(demo.projectId, { order: demo.presentationOrder, status: demo.status })
      }
    }

    // Criteria are loaded once for the competition and filtered per project track
    const criteria = projectIds.length ? await em.find(JudgingCriterion, {
      competitionId, tenantId: auth.tenantId, organizationId: auth.orgId, deletedAt: null,
    } as FilterQuery<JudgingCriterion>) : []

    // Get this judge's existing scores
    const scores = projectIds.length ? await em.find(ProjectScore, {
      judgeId: auth.sub, projectId: { $in: projectIds },
      tenantId: auth.tenantId, organizationId: auth.orgId,
    } as FilterQuery<ProjectScore>) : []
    const projectTrackMap = new Map(projects.map(p => [p.id, p.trackId]))

    // Every criterion row of those scores in one query, for the rated count and weighted average.
    const scoreIds = scores.map(s => s.id)
    const criterionRows = scoreIds.length ? await em.find(CriterionScore, {
      projectScoreId: { $in: scoreIds }, tenantId: auth.tenantId, organizationId: auth.orgId,
    } as FilterQuery<CriterionScore>) : []
    const ratingsByScore = new Map<string, Array<{ criterionId: string; score: number; scale: number | null }>>()
    for (const row of criterionRows) {
      const list = ratingsByScore.get(row.projectScoreId) ?? []
      list.push({ criterionId: row.criterionId, score: row.score, scale: row.scale ?? null })
      ratingsByScore.set(row.projectScoreId, list)
    }
    const summarizeScore = (s: ProjectScore) => {
      const trackId = projectTrackMap.get(s.projectId) ?? null
      const applicable = resolveApplicableCriteria(criteria, { round: s.round, trackId })
      const summary = computeScore(applicable, ratingsByScore.get(s.id) ?? [], { legacySubmitted: isLegacySubmitted(s) })
      const weightedAverage = s.conflictOfInterest || summary.weightedAverage10 === null
        ? null
        : Math.round(summary.weightedAverage10 * 100) / 100
      return { trackId, ratedCount: summary.ratedCount, weightedAverage }
    }

    const translatedProjects = await applyPortalTranslationOverlays(
      projects.map(p => ({
        id: p.id, title: p.title, tagline: p.tagline, team_id: p.teamId,
        team_name: teamMap.get(p.teamId) ?? null, track_id: p.trackId,
        status: p.status, flagged_for_reuse: p.flaggedForReuse,
        uses_preexisting_code: p.usesPreexistingCode,
        description: p.description, demo_url: p.demoUrl, repo_url: p.repoUrl,
        video_url: p.videoUrl, tech_stack: p.techStack,
        problem_statement: p.problemStatement ?? null,
        presentation_url: p.presentationUrl ?? null,
        preexisting_code_description: p.preexistingCodeDescription ?? null,
      })),
      {
        entityType: 'projects:project',
        locale,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
        container,
      },
    )

    const screenshotMap = new Map(projects.map(p => [p.id, p.screenshotIds ?? []]))
    // Sorted after the overlays so a translated title is what orders slot-less projects.
    const queue = sortByDemoOrder(translatedProjects.map(p => ({
      ...p,
      track_name: trackNameMap.get(p.track_id) ?? null,
      demo: demoMap.get(p.id) ?? null,
      criteria_count: resolveApplicableCriteria(criteria, { round: QUEUE_ROUND, trackId: p.track_id }).length,
      screenshots: (screenshotMap.get(p.id) ?? [])
        .filter(Boolean)
        .map(id => ({ id, url: buildPortalAssetUrl(id) })),
    })))

    return NextResponse.json({
      panels: panels.map(p => ({ id: p.id, name: p.name, round: p.round })),
      projects: queue,
      scores: scores.map(s => {
        const summary = summarizeScore(s)
        return {
          id: s.id, project_id: s.projectId, round: s.round,
          total_score: s.totalScore, is_submitted: s.isSubmitted,
          conflict_of_interest: s.conflictOfInterest,
          track_id: summary.trackId,
          rated_count: summary.ratedCount,
          weighted_average: summary.weightedAverage,
        }
      }),
      voting_open: votingOpen,
    })
  } catch (error) {
    console.error('[portal/my-assignments] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal', summary: 'Judge assignments',
  methods: {
    GET: {
      summary: 'Get assigned projects and scoring status for current judge',
      description: 'Projects are returned in preliminary demo order (projects without a slot last, by title), '
        + 'each with its demo slot, applicable criteria count, track name and screenshots. '
        + 'Each score carries `rated_count` and `weighted_average` (0–10, null when nothing is rated or recused). '
        + '`voting_open` is false once competition results are published.',
    },
  },
}
