import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { ProjectScore, CriterionScore, JudgingCriterion, JudgePanelJudge } from '../../../data/entities'
import { Project } from '../../../../projects/data/entities'
import { saveScoreSchema } from '../../../data/validators'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { applyPortalTranslationOverlays, resolvePortalLocale } from '@/lib/portal-translations'

export const metadata = {
  GET: { requireCustomerAuth: true },
  POST: { requireCustomerAuth: true },
}

// GET: load existing score + criteria for a project
export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

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

    // Load project to get its trackId for criteria filtering
    const project = await em.findOne(Project, {
      id: projectId, competitionId, deletedAt: null,
    } as FilterQuery<Project>)

    // Load criteria for this competition — filtered by track (track-specific + global)
    const criteriaFilter: FilterQuery<JudgingCriterion> = {
      competitionId, deletedAt: null,
      $and: [
        { $or: [{ round }, { round: 'both' }] },
        { $or: [{ trackId: null }, ...(project?.trackId ? [{ trackId: project.trackId }] : [])] },
      ],
    } as FilterQuery<JudgingCriterion>
    const criteria = await em.find(JudgingCriterion, criteriaFilter, { orderBy: { order: 'ASC' } })

    // Load existing score
    const projectScore = await em.findOne(ProjectScore, {
      projectId, judgeId: auth.sub, round,
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

    const body = await req.json()
    const parsed = saveScoreSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Resolve 'auto' judge_panel_id to the judge's actual panel
    let judgePanelId = parsed.judge_panel_id
    if (judgePanelId === 'auto') {
      const panelJudge = await em.findOne(JudgePanelJudge, {
        judgeId: auth.sub,
        tenantId: auth.tenantId,
      } as FilterQuery<JudgePanelJudge>)
      judgePanelId = panelJudge?.panelId ?? '00000000-0000-0000-0000-000000000000'
    }

    // Wrap multi-step write in a transaction for atomicity
    const scoreId = await em.transactional(async (txEm) => {
      const now = new Date()

      // Find or create ProjectScore
      let projectScore = await txEm.findOne(ProjectScore, {
        projectId: parsed.project_id, judgeId: auth.sub, round: parsed.round,
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
        await txEm.persistAndFlush(projectScore)
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
          competitionId: parsed.competition_id, deletedAt: null,
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
