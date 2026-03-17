import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { AuthContext } from '@open-mercato/shared/lib/auth/server'
import { submitScoreSchema, listScoreSchema, projectScoreListItemSchema } from '../../data/validators'
import { ScoringService } from '../../lib/ScoringService'
import { judgingTag, errorSchema, okSchema } from '../openapi'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['judging.scores.view'] },
  POST: { requireAuth: true },
  PUT: { requireAuth: true },
}

// ---------------------------------------------------------------------------
// GET — List scores
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const parsed = listScoreSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const knex = em.getKnex()

  const q = parsed.data
  let query = knex('judging_project_score as ps')
    .select(
      'ps.id', 'ps.project_id', 'ps.judge_id', 'ps.judge_panel_id',
      'ps.round', 'ps.total_score', 'ps.comment', 'ps.conflict_of_interest',
      'ps.is_submitted', 'ps.submitted_at', 'ps.competition_id',
      'ps.created_at', 'ps.updated_at',
    )
    .orderBy('ps.created_at', 'desc')

  if (q.competitionId) query = query.where('ps.competition_id', q.competitionId)
  if (q.projectId) query = query.where('ps.project_id', q.projectId)
  if (q.round) query = query.where('ps.round', q.round)
  if (q.isSubmitted !== undefined) query = query.where('ps.is_submitted', q.isSubmitted)

  // Judges can only see their own scores (unless admin)
  const isAdmin = ctx.auth?.features?.includes('judging.scores.view')
  if (q.judgeId) {
    query = query.where('ps.judge_id', q.judgeId)
  } else if (!isAdmin) {
    // Non-admin: restrict to own scores via customerUserId
    const customerUserId = ctx.auth?.customerUserId ?? ctx.auth?.sub
    if (customerUserId) {
      query = query.where('ps.judge_id', customerUserId)
    }
  }

  const offset = (q.page - 1) * q.pageSize
  const countQuery = query.clone().clearSelect().clearOrder().count('* as total').first()
  const [countResult, items] = await Promise.all([
    countQuery,
    query.limit(q.pageSize).offset(offset),
  ])

  const total = Number((countResult as Record<string, unknown>)?.total ?? 0)

  return NextResponse.json({
    items: items.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      judgeId: String(row.judge_id),
      judgePanelId: String(row.judge_panel_id),
      round: String(row.round),
      totalScore: row.total_score != null ? Number(row.total_score) : null,
      comment: row.comment ? String(row.comment) : null,
      conflictOfInterest: Boolean(row.conflict_of_interest),
      isSubmitted: Boolean(row.is_submitted),
      submittedAt: row.submitted_at ? new Date(row.submitted_at as string).toISOString() : null,
      competitionId: String(row.competition_id),
      createdAt: new Date(row.created_at as string).toISOString(),
      updatedAt: new Date(row.updated_at as string).toISOString(),
    })),
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.ceil(total / q.pageSize),
  })
}

// ---------------------------------------------------------------------------
// POST — Submit/create a score
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  const body = await req.json().catch(() => ({}))
  const parsed = submitScoreSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { projectId, round, judgePanelId, competitionId, criterionScores, comment, privateNotes, conflictOfInterest, isSubmitted } = parsed.data
  const judgeId = ctx.auth?.customerUserId ?? ctx.auth?.sub
  if (!judgeId) {
    return NextResponse.json({ error: 'Judge identity required' }, { status: 401 })
  }

  const tenantId = ctx.auth?.tenantId
  const organizationId = (ctx as unknown as { selectedOrganizationId?: string }).selectedOrganizationId ?? ctx.auth?.orgId
  if (!tenantId || !organizationId) {
    return NextResponse.json({ error: 'Tenant and organization required' }, { status: 400 })
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const knex = em.getKnex()

  // Upsert ProjectScore
  let projectScore = await knex('judging_project_score')
    .where({ project_id: projectId, judge_id: judgeId, round })
    .first()

  if (projectScore) {
    await knex('judging_project_score')
      .where('id', projectScore.id)
      .update({
        comment: comment ?? null,
        private_notes: privateNotes ?? null,
        conflict_of_interest: conflictOfInterest,
        is_submitted: isSubmitted,
        submitted_at: isSubmitted ? new Date() : null,
        updated_at: new Date(),
      })
  } else {
    const [inserted] = await knex('judging_project_score')
      .insert({
        project_id: projectId,
        judge_id: judgeId,
        judge_panel_id: judgePanelId,
        round,
        comment: comment ?? null,
        private_notes: privateNotes ?? null,
        conflict_of_interest: conflictOfInterest,
        is_submitted: isSubmitted,
        submitted_at: isSubmitted ? new Date() : null,
        competition_id: competitionId,
        tenant_id: tenantId,
        organization_id: organizationId,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*')
    projectScore = inserted
  }

  const projectScoreId = projectScore.id

  // Upsert CriterionScores
  for (const cs of criterionScores) {
    const existing = await knex('judging_criterion_score')
      .where({ project_score_id: projectScoreId, criterion_id: cs.criterionId })
      .first()

    if (existing) {
      await knex('judging_criterion_score')
        .where('id', existing.id)
        .update({
          score: cs.score,
          note: cs.note ?? null,
          updated_at: new Date(),
        })
    } else {
      await knex('judging_criterion_score').insert({
        project_score_id: projectScoreId,
        criterion_id: cs.criterionId,
        score: cs.score,
        note: cs.note ?? null,
        tenant_id: tenantId,
        organization_id: organizationId,
        updated_at: new Date(),
      })
    }
  }

  // Compute total score
  const scoringService = new ScoringService(em)
  const totalScore = await scoringService.computeProjectScore(projectScoreId)

  // Emit event if submitted
  if (isSubmitted) {
    try {
      const eventBus = container.resolve('eventBus') as {
        emit?: (event: string, payload: unknown) => Promise<void>
        emitEvent?: (event: string, payload: unknown) => Promise<void>
      }
      const eventPayload = {
        projectScoreId,
        projectId,
        judgeId,
        round,
        competitionId,
        totalScore,
        tenantId,
        organizationId,
      }
      if (typeof eventBus.emit === 'function') {
        await eventBus.emit('judging.score.submitted', eventPayload)
      } else if (typeof eventBus.emitEvent === 'function') {
        await eventBus.emitEvent('judging.score.submitted', eventPayload)
      }
    } catch (err) {
      console.warn('[judging] Failed to emit score.submitted event', {
        projectScoreId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    projectScoreId,
    totalScore,
    isSubmitted,
  }, { status: projectScore ? 200 : 201 })
}

// ---------------------------------------------------------------------------
// PUT — Update a score (alias for POST with same semantics)
// ---------------------------------------------------------------------------

export async function PUT(
  req: NextRequest,
  ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  return POST(req, ctx)
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

export const openApi: OpenApiRouteDoc = {
  GET: {
    summary: 'List project scores',
    description: 'Returns project scores. Judges see only their own scores; admins see all.',
    tags: [judgingTag],
    responses: {
      200: {
        description: 'Paginated list of scores',
        content: { 'application/json': { schema: z.object({ items: z.array(projectScoreListItemSchema) }).passthrough() } },
      },
    },
  },
  POST: {
    summary: 'Submit or save a score',
    description: 'Creates or updates a project score with criterion scores. Auto-computes totalScore.',
    tags: [judgingTag],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: submitScoreSchema } },
    },
    responses: {
      200: { description: 'Score updated', content: { 'application/json': { schema: okSchema } } },
      201: { description: 'Score created', content: { 'application/json': { schema: okSchema } } },
      400: { description: 'Invalid request', content: { 'application/json': { schema: errorSchema } } },
    },
  },
}
