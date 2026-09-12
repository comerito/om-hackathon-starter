import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { ProjectScore, CriterionScore, JudgingCriterion, JudgePanel, JudgePanelJudge, JudgePanelTrack } from '../../../data/entities'
import { Project } from '../../../../projects/data/entities'
import { saveScoreSchema } from '../../../data/validators'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { applyPortalTranslationOverlays, resolvePortalLocale } from '@/lib/portal-translations'
import { PORTAL_SCORE_FEATURE, requirePortalFeatures } from '../../../lib/portalAuth'
import { SCORING_PANEL_DENIAL_MESSAGE, resolveScoringPanel } from '../../../lib/panelScope'

// NOTE: `requireCustomerAuth` / `requireCustomerFeatures` are NOT enforced for API routes —
// the dispatcher in `src/app/api/[...slug]/route.ts` only reads `requireAuth`,
// `requireRoles`, `requireFeatures` and `rateLimit`. They are kept here as the declaration of
// intent; the enforcement lives in the handlers below (`requirePortalFeatures`).
export const metadata = {
  GET: { requireCustomerAuth: true, requireCustomerFeatures: [PORTAL_SCORE_FEATURE] },
  POST: { requireCustomerAuth: true, requireCustomerFeatures: [PORTAL_SCORE_FEATURE] },
}

/** Entity id used by the mutation-guard registry for `judging_project_score` writes. */
const SCORE_RESOURCE_KIND = 'judging:project_score'

// GET: load existing score + criteria for a project
export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const forbidden = requirePortalFeatures(auth, [PORTAL_SCORE_FEATURE])
    if (forbidden) return forbidden

    const url = new URL(req.url)
    const projectId = url.searchParams.get('project_id')
    const round = url.searchParams.get('round') || 'preliminary'
    const competitionId = url.searchParams.get('competition_id')

    if (!projectId || !competitionId) {
      return NextResponse.json({ error: 'project_id and competition_id required' }, { status: 400 })
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const locale = await resolvePortalLocale(req, { auth, container })

    // Load project to get its trackId for criteria filtering. Scoped to the caller's tenant and
    // organisation: without it, any portal user could read another tenant's criteria by id.
    const project = await em.findOne(Project, {
      id: projectId, competitionId, tenantId: auth.tenantId, organizationId: auth.orgId, deletedAt: null,
    } as FilterQuery<Project>)
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    // Load criteria for this competition — filtered by track (track-specific + global)
    const criteriaFilter: FilterQuery<JudgingCriterion> = {
      competitionId, tenantId: auth.tenantId, organizationId: auth.orgId, deletedAt: null,
      $and: [
        { $or: [{ round }, { round: 'both' }] },
        { $or: [{ trackId: null }, { trackId: project.trackId }] },
      ],
    } as FilterQuery<JudgingCriterion>
    const criteria = await em.find(JudgingCriterion, criteriaFilter, { orderBy: { order: 'ASC' } })

    // Load existing score
    const projectScore = await em.findOne(ProjectScore, {
      projectId, judgeId: auth.sub, round, tenantId: auth.tenantId, organizationId: auth.orgId,
    } as FilterQuery<ProjectScore>)

    let criterionScores: Array<{ criterion_id: string; score: number; note: string | null }> = []
    if (projectScore) {
      const cs = await em.find(CriterionScore, {
        projectScoreId: projectScore.id,
      } as FilterQuery<CriterionScore>)
      criterionScores = cs.map(c => ({ criterion_id: c.criterionId, score: c.score, note: c.note ?? null }))
    }

    const translatedCriteria = await applyPortalTranslationOverlays(
      criteria.map(c => ({
        id: c.id, name: c.name, description: c.description,
        max_score: c.maxScore, weight: c.weight, order: c.order, round: c.round,
      })),
      {
        entityType: 'judging:judging_criterion',
        locale,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
        container,
      },
    )

    return NextResponse.json({
      criteria: translatedCriteria,
      score: projectScore ? {
        id: projectScore.id,
        total_score: projectScore.totalScore,
        comment: projectScore.comment,
        private_notes: projectScore.privateNotes,
        conflict_of_interest: projectScore.conflictOfInterest,
        is_submitted: projectScore.isSubmitted,
        criterion_scores: criterionScores,
      } : null,
    })
  } catch (error) {
    console.error('[portal/score-project] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: save/submit score
export async function POST(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const forbidden = requirePortalFeatures(auth, [PORTAL_SCORE_FEATURE])
    if (forbidden) return forbidden

    const body = await req.json()
    const requested = saveScoreSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // The project must exist inside the competition the caller named, in the caller's own
    // tenant and organisation. A mismatch is reported as "not found" so the endpoint cannot be
    // used to probe which project ids exist elsewhere.
    const project = await em.findOne(Project, {
      id: requested.project_id, competitionId: requested.competition_id,
      tenantId: auth.tenantId, organizationId: auth.orgId, deletedAt: null,
    } as FilterQuery<Project>)
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const existingScore = await em.findOne(ProjectScore, {
      projectId: requested.project_id, judgeId: auth.sub, round: requested.round,
      tenantId: auth.tenantId, organizationId: auth.orgId,
    } as FilterQuery<ProjectScore>)

    // Custom (non-`makeCrudRoute`) write route — run the mutation-guard registry, per
    // AGENTS.md CRITICAL rule 5. `userFeatures` is passed explicitly: the wrapper's fallback
    // resolves the STAFF rbacService, which knows nothing about a portal user id.
    const guard = await runRouteMutationGuards({
      container,
      req,
      auth: {
        userId: auth.sub,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
        userFeatures: auth.resolvedFeatures ?? [],
      },
      input: {
        resourceKind: SCORE_RESOURCE_KIND,
        resourceId: existingScore?.id ?? null,
        operation: existingScore ? 'update' : 'create',
        mutationPayload: { ...requested },
      },
    })
    if (!guard.ok) return guard.response

    // A guard may rewrite the payload; re-validate the merged result rather than trusting it.
    const parsed = guard.modifiedPayload
      ? saveScoreSchema.parse({ ...requested, ...guard.modifiedPayload })
      : requested

    // Resolve the panel the score is filed under. The caller must sit on a judge panel of the
    // competition that owns the project, and that panel's tracks must cover the project;
    // `'auto'` picks one of those panels and an explicit id must be one of them. There is no
    // fallback — the previous all-zeros sentinel meant an unauthorised caller's score was
    // persisted as if a panel had approved it.
    const memberships = await em.find(JudgePanelJudge, {
      judgeId: auth.sub, tenantId: auth.tenantId, organizationId: auth.orgId,
    } as FilterQuery<JudgePanelJudge>)
    const panelIds = memberships.map(m => m.panelId)
    const [panels, panelTracks] = panelIds.length
      ? await Promise.all([
        em.find(JudgePanel, {
          id: { $in: panelIds },
          tenantId: auth.tenantId, organizationId: auth.orgId, deletedAt: null,
        } as FilterQuery<JudgePanel>),
        em.find(JudgePanelTrack, {
          panelId: { $in: panelIds },
          tenantId: auth.tenantId, organizationId: auth.orgId,
        } as FilterQuery<JudgePanelTrack>),
      ])
      : [[], []]

    const resolution = resolveScoringPanel({
      memberships: panels.map(p => ({ panelId: p.id, competitionId: p.competitionId, round: p.round })),
      panelTracks: panelTracks.map(pt => ({ panelId: pt.panelId, trackId: pt.trackId })),
      project: { id: project.id, competitionId: project.competitionId, trackId: project.trackId },
      requestedPanelId: parsed.judge_panel_id,
      round: parsed.round,
    })
    if (!resolution.ok) {
      return NextResponse.json({ error: SCORING_PANEL_DENIAL_MESSAGE[resolution.reason] }, { status: 403 })
    }
    const judgePanelId = resolution.panelId

    // Wrap multi-step write in a transaction for atomicity
    const scoreId = await em.transactional(async (txEm) => {
      const now = new Date()

      // Find or create ProjectScore
      let projectScore = await txEm.findOne(ProjectScore, {
        projectId: parsed.project_id, judgeId: auth.sub, round: parsed.round,
        tenantId: auth.tenantId, organizationId: auth.orgId,
      } as FilterQuery<ProjectScore>)

      if (!projectScore) {
        projectScore = txEm.create(ProjectScore, {
          projectId: parsed.project_id, judgeId: auth.sub!, judgePanelId,
          round: parsed.round, competitionId: parsed.competition_id,
          comment: parsed.comment ?? null, privateNotes: parsed.private_notes ?? null,
          conflictOfInterest: parsed.conflict_of_interest, isSubmitted: parsed.is_submitted,
          submittedAt: parsed.is_submitted ? now : null,
          tenantId: auth.tenantId!, organizationId: auth.orgId!,
          createdAt: now, updatedAt: now,
        })
        txEm.persist(projectScore)
        await txEm.flush()
      } else {
        projectScore.comment = parsed.comment ?? projectScore.comment
        projectScore.privateNotes = parsed.private_notes ?? projectScore.privateNotes
        projectScore.conflictOfInterest = parsed.conflict_of_interest
        if (parsed.is_submitted && !projectScore.isSubmitted) {
          projectScore.isSubmitted = true
          projectScore.submittedAt = now
        }
        projectScore.updatedAt = now
      }

      // Upsert criterion scores
      for (const cs of parsed.criterion_scores) {
        let criterionScore = await txEm.findOne(CriterionScore, {
          projectScoreId: projectScore.id, criterionId: cs.criterion_id,
        } as FilterQuery<CriterionScore>)
        if (!criterionScore) {
          criterionScore = txEm.create(CriterionScore, {
            projectScoreId: projectScore.id, criterionId: cs.criterion_id,
            score: cs.score, note: cs.note ?? null,
            tenantId: auth.tenantId!, organizationId: auth.orgId!, updatedAt: now,
          })
          txEm.persist(criterionScore)
        } else {
          criterionScore.score = cs.score
          criterionScore.note = cs.note ?? criterionScore.note
          criterionScore.updatedAt = now
        }
      }

      // Compute totalScore (weighted sum)
      if (parsed.criterion_scores.length > 0) {
        const criteria = await txEm.find(JudgingCriterion, {
          competitionId: parsed.competition_id, tenantId: auth.tenantId,
          organizationId: auth.orgId, deletedAt: null,
        } as FilterQuery<JudgingCriterion>)
        const criteriaMap = new Map(criteria.map(c => [c.id, c]))
        let totalScore = 0
        for (const cs of parsed.criterion_scores) {
          const criterion = criteriaMap.get(cs.criterion_id)
          if (criterion) totalScore += (cs.score / criterion.maxScore) * criterion.weight * 100
        }
        projectScore.totalScore = Math.round(totalScore * 100) / 100
      }

      await txEm.flush()
      return projectScore.id
    })

    // After commit only — a guard callback must never be able to roll the write back.
    try {
      await guard.runAfterSuccess()
    } catch (guardError) {
      console.error('[portal/score-project] mutation guard afterSuccess failed:', guardError)
    }

    return NextResponse.json({ ok: true, score_id: scoreId })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[portal/score-project] POST error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal', summary: 'Score a project',
  methods: { GET: { summary: 'Get criteria and existing score' }, POST: { summary: 'Save/submit score' } },
}
