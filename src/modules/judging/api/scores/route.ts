import { NextResponse } from 'next/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { ProjectScore, CriterionScore } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['judging.scores.view'] },
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    const projectId = url.searchParams.get('project_id')
    const judgeId = url.searchParams.get('judge_id')
    const round = url.searchParams.get('round')

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    const where: Record<string, unknown> = { tenantId: auth.tenantId }
    if (competitionId) where.competitionId = competitionId
    if (projectId) where.projectId = projectId
    if (judgeId) where.judgeId = judgeId
    if (round) where.round = round

    const scores = await em.find(ProjectScore, where as FilterQuery<ProjectScore>, {
      orderBy: { createdAt: 'DESC' },
      limit: 200,
    })

    // Load criterion scores for each
    const scoreIds = scores.map(s => s.id)
    const criterionScores = scoreIds.length
      ? await em.find(CriterionScore, { projectScoreId: { $in: scoreIds }, tenantId: auth.tenantId } as FilterQuery<CriterionScore>)
      : []

    const csMap = new Map<string, Array<{ criterion_id: string; score: number; note: string | null }>>()
    for (const cs of criterionScores) {
      const arr = csMap.get(cs.projectScoreId) ?? []
      arr.push({ criterion_id: cs.criterionId, score: cs.score, note: cs.note ?? null })
      csMap.set(cs.projectScoreId, arr)
    }

    return NextResponse.json({
      items: scores.map(s => ({
        id: s.id, project_id: s.projectId, judge_id: s.judgeId,
        judge_panel_id: s.judgePanelId, round: s.round,
        total_score: s.totalScore, comment: s.comment, private_notes: s.privateNotes,
        conflict_of_interest: s.conflictOfInterest, is_submitted: s.isSubmitted,
        submitted_at: s.submittedAt?.toISOString() ?? null,
        competition_id: s.competitionId,
        criterion_scores: csMap.get(s.id) ?? [],
        created_at: s.createdAt, updated_at: s.updatedAt,
      })),
      total: scores.length,
    })
  } catch (error) {
    console.error('[judging/scores] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Judging', summary: 'Score management',
  methods: { GET: { summary: 'List scores with criterion breakdowns' } },
}
