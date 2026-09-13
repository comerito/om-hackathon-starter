import { NextResponse } from 'next/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { CustomerUser } from '@open-mercato/core/modules/customer_accounts/data/entities'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { ProjectScore, CriterionScore } from '../../data/entities'
import { Project } from '../../../projects/data/entities'
import { scoresQuerySchema } from '../../data/validators'
import { buildScoreListFilter } from '../../lib/scoreQuery'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['judging.scores.view'] },
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId || !auth.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const url = new URL(req.url)

    // `competition_id` is required — see `scoresQuerySchema`. Without it this endpoint returned
    // the 200 most recent scores of the whole tenant, which is what interleaved two
    // competitions in the back-office Scoring Progress tab.
    const parsed = scoresQuerySchema.safeParse({
      competition_id: url.searchParams.get('competition_id') ?? undefined,
      project_id: url.searchParams.get('project_id') || null,
      judge_id: url.searchParams.get('judge_id') || null,
      round: url.searchParams.get('round') || null,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid query parameters' },
        { status: 400 },
      )
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    const where = buildScoreListFilter(parsed.data, {
      tenantId: auth.tenantId,
      organizationId: auth.orgId,
    })

    const scores = await em.find(ProjectScore, where as FilterQuery<ProjectScore>, {
      orderBy: { createdAt: 'DESC' },
      limit: 200,
    })

    // Load criterion scores for each
    const scoreIds = scores.map(s => s.id)
    const criterionScores = scoreIds.length
      ? await em.find(CriterionScore, {
        projectScoreId: { $in: scoreIds }, tenantId: auth.tenantId, organizationId: auth.orgId,
      } as FilterQuery<CriterionScore>)
      : []

    // Resolve the names the tab shows. `customer_users.display_name` / `email` are declared in
    // the customer_accounts encryption map, so they must be read through
    // `findWithDecryption` — a plain `em.find` would hand back ciphertext on a tenant that has
    // encryption seeded.
    const projectIds = [...new Set(scores.map(s => s.projectId))]
    const judgeIds = [...new Set(scores.map(s => s.judgeId))]
    const [projects, judges] = await Promise.all([
      projectIds.length
        ? em.find(Project, {
          id: { $in: projectIds }, tenantId: auth.tenantId, organizationId: auth.orgId,
        } as FilterQuery<Project>)
        : Promise.resolve([]),
      judgeIds.length
        ? findWithDecryption(
          em,
          CustomerUser,
          { id: { $in: judgeIds }, tenantId: auth.tenantId } as FilterQuery<CustomerUser>,
          { fields: ['id', 'displayName', 'email'] },
          { tenantId: auth.tenantId, organizationId: auth.orgId },
        )
        : Promise.resolve([]),
    ])
    const projectTitleMap = new Map(projects.map(p => [p.id, p.title]))
    const judgeNameMap = new Map(judges.map(j => [j.id, j.displayName || j.email || null]))

    const csMap = new Map<string, Array<{ criterion_id: string; score: number; note: string | null }>>()
    for (const cs of criterionScores) {
      const arr = csMap.get(cs.projectScoreId) ?? []
      arr.push({ criterion_id: cs.criterionId, score: cs.score, note: cs.note ?? null })
      csMap.set(cs.projectScoreId, arr)
    }

    return NextResponse.json({
      items: scores.map(s => ({
        id: s.id, project_id: s.projectId, judge_id: s.judgeId,
        project_title: projectTitleMap.get(s.projectId) ?? null,
        judge_name: judgeNameMap.get(s.judgeId) ?? null,
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
  methods: { GET: { summary: 'List scores with criterion breakdowns for one competition' } },
}
