import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { ProjectScore, CriterionScore, JudgingCriterion, JudgePanel, JudgePanelJudge, JudgePanelTrack } from '../../../data/entities'
import { Project } from '../../../../projects/data/entities'
import { Competition } from '../../../../competitions/data/entities'
import { judgingRoundValues, portalSaveVoteSchema } from '../../../data/validators'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { applyPortalTranslationOverlays, resolvePortalLocale } from '@/lib/portal-translations'
import { PORTAL_SCORE_FEATURE, requirePortalFeatures } from '../../../lib/portalAuth'
import { SCORING_PANEL_DENIAL_MESSAGE, resolveScoringPanel } from '../../../lib/panelScope'
import { SCORE_RESOURCE_KIND } from '../../../lib/resourceKinds'
import { areResultsPublished } from '../../../lib/resultsScope'
import { resolveApplicableCriteria } from '../../../lib/scoring'
import { VotingClosedError, saveJudgeVote, type SaveJudgeVoteResult } from '../../../lib/portalVote'
import { createPortalVoteStore } from '../../../lib/portalVoteStore'

// NOTE: `requireCustomerAuth` / `requireCustomerFeatures` are NOT enforced for API routes —
// the dispatcher in `src/app/api/[...slug]/route.ts` only reads `requireAuth`,
// `requireRoles`, `requireFeatures` and `rateLimit`. They are kept here as the declaration of
// intent; the enforcement lives in the handlers below (`requirePortalFeatures`).
export const metadata = {
  GET: { requireCustomerAuth: true, requireCustomerFeatures: [PORTAL_SCORE_FEATURE] },
  POST: { requireCustomerAuth: true, requireCustomerFeatures: [PORTAL_SCORE_FEATURE] },
}

const VOTING_CLOSED_MESSAGE = 'Voting is closed'

type EventBus = { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }

function roundTo(value: number | null, decimals: number): number | null {
  if (value === null) return null
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

// GET: load existing score + criteria for a project
export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const forbidden = requirePortalFeatures(auth, [PORTAL_SCORE_FEATURE])
    if (forbidden) return forbidden

    const url = new URL(req.url)
    const projectId = url.searchParams.get('project_id')
    const roundParam = url.searchParams.get('round') || 'preliminary'
    const competitionId = url.searchParams.get('competition_id')

    if (!projectId || !competitionId) {
      return NextResponse.json({ error: 'project_id and competition_id required' }, { status: 400 })
    }
    const roundParsed = z.enum(judgingRoundValues).safeParse(roundParam)
    if (!roundParsed.success) return NextResponse.json({ error: 'Invalid round' }, { status: 400 })
    const round = roundParsed.data

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const locale = await resolvePortalLocale(req, { auth, container })

    // Load project to get its trackId for criteria filtering. Scoped to the caller's tenant and
    // organisation: without it, any portal user could read another tenant's criteria by id.
    const project = await em.findOne(Project, {
      id: projectId, competitionId, tenantId: auth.tenantId, organizationId: auth.orgId, deletedAt: null,
    } as FilterQuery<Project>)
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const competition = await em.findOne(Competition, {
      id: competitionId, tenantId: auth.tenantId, organizationId: auth.orgId, deletedAt: null,
    } as FilterQuery<Competition>)
    const votingOpen = competition ? !areResultsPublished(competition.stage) : false

    // Criteria applicable to this project: this round or `both`, global or the project's track.
    const allCriteria = await em.find(JudgingCriterion, {
      competitionId, tenantId: auth.tenantId, organizationId: auth.orgId, deletedAt: null,
    } as FilterQuery<JudgingCriterion>, { orderBy: { order: 'ASC' } })
    const criteria = resolveApplicableCriteria(allCriteria, { round, trackId: project.trackId })

    // Load existing score
    const projectScore = await em.findOne(ProjectScore, {
      projectId, judgeId: auth.sub, round, tenantId: auth.tenantId, organizationId: auth.orgId,
    } as FilterQuery<ProjectScore>)

    let criterionScores: Array<{ criterion_id: string; score: number; scale: number | null; note: string | null }> = []
    if (projectScore) {
      const cs = await em.find(CriterionScore, {
        projectScoreId: projectScore.id, tenantId: auth.tenantId, organizationId: auth.orgId,
      } as FilterQuery<CriterionScore>)
      criterionScores = cs.map(c => ({
        criterion_id: c.criterionId, score: c.score, scale: c.scale ?? null, note: c.note ?? null,
      }))
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
        submitted_at: projectScore.submittedAt ? projectScore.submittedAt.toISOString() : null,
        criterion_scores: criterionScores,
      } : null,
      voting_open: votingOpen,
    })
  } catch (error) {
    console.error('[portal/score-project] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: save part of a vote (one click). The server derives "voted" from the persisted ratings.
export async function POST(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const forbidden = requirePortalFeatures(auth, [PORTAL_SCORE_FEATURE])
    if (forbidden) return forbidden

    const body = await req.json()
    const requested = portalSaveVoteSchema.parse(body)
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

    // Votes stay editable until results are published. Checked here, before the guard, and
    // again under the row lock inside the write transaction.
    const competition = await em.findOne(Competition, {
      id: requested.competition_id, tenantId: auth.tenantId, organizationId: auth.orgId, deletedAt: null,
    } as FilterQuery<Competition>)
    if (!competition) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    if (areResultsPublished(competition.stage)) {
      return NextResponse.json({ error: VOTING_CLOSED_MESSAGE }, { status: 409 })
    }

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
      ? portalSaveVoteSchema.parse({ ...requested, ...guard.modifiedPayload })
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

    // Only criteria that apply to this project in this round may be rated.
    const allCriteria = await em.find(JudgingCriterion, {
      competitionId: parsed.competition_id, tenantId: auth.tenantId, organizationId: auth.orgId, deletedAt: null,
    } as FilterQuery<JudgingCriterion>)
    const applicable = resolveApplicableCriteria(allCriteria, { round: parsed.round, trackId: project.trackId })
    const applicableIds = new Set(applicable.map(c => c.id))
    const sentCriterionScores = parsed.criterion_scores ?? []
    const notApplicable = sentCriterionScores.filter(cs => !applicableIds.has(cs.criterion_id))
    if (notApplicable.length > 0) {
      return NextResponse.json({
        error: 'Criterion does not apply to this project',
        criterion_ids: [...new Set(notApplicable.map(cs => cs.criterion_id))],
      }, { status: 422 })
    }

    let result: SaveJudgeVoteResult
    try {
      result = await saveJudgeVote(createPortalVoteStore(em), {
        key: {
          projectId: parsed.project_id, judgeId: auth.sub, round: parsed.round,
          tenantId: auth.tenantId, organizationId: auth.orgId,
        },
        competitionId: parsed.competition_id,
        judgePanelId,
        applicable,
        criterionScores: sentCriterionScores.map(cs => ({
          criterionId: cs.criterion_id, stars: cs.stars, note: cs.note,
        })),
        comment: parsed.comment,
        privateNotes: parsed.private_notes,
        conflictOfInterest: parsed.conflict_of_interest,
      })
    } catch (writeError) {
      if (writeError instanceof VotingClosedError) {
        return NextResponse.json({ error: VOTING_CLOSED_MESSAGE }, { status: 409 })
      }
      throw writeError
    }

    // After commit only — a guard callback must never be able to roll the write back.
    try {
      await guard.runAfterSuccess()
    } catch (guardError) {
      console.error('[portal/score-project] mutation guard afterSuccess failed:', guardError)
    }

    // Events only on vote-state transitions: both are client-broadcast, one per star click would
    // flood the backend.
    if (result.transition) {
      try {
        const eventBus = container.resolve('eventBus') as EventBus
        await eventBus.emit(result.transition, {
          projectScoreId: result.scoreId,
          projectId: parsed.project_id,
          judgeId: auth.sub,
          round: parsed.round,
          totalScore: result.totalScore,
          isSubmitted: result.after.voted,
          conflictOfInterest: result.after.recused,
          competitionId: parsed.competition_id,
          tenantId: auth.tenantId,
          organizationId: auth.orgId,
        })
      } catch (emitError) {
        console.error('[portal/score-project] event emit failed:', emitError)
      }
    }

    const recused = result.after.recused
    return NextResponse.json({
      ok: true,
      score_id: result.scoreId,
      rated_count: result.summary.ratedCount,
      criteria_count: result.summary.criteriaCount,
      is_voted: result.after.voted,
      weighted_average: recused ? null : roundTo(result.summary.weightedAverage10, 2),
      total_score: recused ? null : result.totalScore,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[portal/score-project] POST error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}

const errorSchema = z.object({ error: z.string() })

const criterionScoreSchema = z.object({
  criterion_id: z.string().uuid(),
  score: z.number().int().describe('Stars (1–10) when `scale` is 10; points on 0…max_score when `scale` is null (legacy)'),
  scale: z.number().int().nullable().describe('10 = star rating; null = legacy row written before star voting'),
  note: z.string().nullable(),
})

const getResponseSchema = z.object({
  criteria: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    max_score: z.number().int(),
    weight: z.number(),
    order: z.number().int(),
    round: z.string(),
  })),
  score: z.object({
    id: z.string().uuid(),
    total_score: z.number().nullable(),
    comment: z.string().nullable(),
    private_notes: z.string().nullable(),
    conflict_of_interest: z.boolean(),
    is_submitted: z.boolean().describe('Voted: every applicable criterion rated and not recused'),
    submitted_at: z.string().nullable().describe('First time the vote became complete'),
    criterion_scores: z.array(criterionScoreSchema),
  }).nullable(),
  voting_open: z.boolean().describe('False once competition results are published'),
})

const postResponseSchema = z.object({
  ok: z.literal(true),
  score_id: z.string().uuid(),
  rated_count: z.number().int(),
  criteria_count: z.number().int(),
  is_voted: z.boolean(),
  weighted_average: z.number().nullable().describe('Weighted average of the ratings on 0–10; null when nothing is rated or recused'),
  total_score: z.number().nullable().describe('weighted_average × 10 (0–100); null when nothing is rated or recused'),
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal', summary: 'Judge vote on a project',
  methods: {
    GET: {
      summary: 'Get applicable criteria and the judge\'s own vote',
      query: z.object({
        project_id: z.string().uuid(),
        competition_id: z.string().uuid(),
        round: z.enum(judgingRoundValues).optional(),
      }),
      responses: [{ status: 200, description: 'Criteria, existing vote and whether voting is open', schema: getResponseSchema }],
      errors: [
        { status: 400, description: 'Missing or invalid query parameters', schema: errorSchema },
        { status: 401, description: 'No portal session', schema: errorSchema },
        { status: 403, description: 'Missing portal scoring feature', schema: errorSchema },
        { status: 404, description: 'Project not found in the caller scope', schema: errorSchema },
      ],
    },
    POST: {
      summary: 'Save part of a vote',
      description: 'Partial save: only the fields sent are written (omitted = unchanged, null = cleared). '
        + 'Each `criterion_scores` item sets 1–10 stars and/or a note. The server recomputes the vote from all '
        + 'persisted ratings under a row lock: the project is voted once every applicable criterion is rated '
        + 'and the judge is not recused. `conflict_of_interest` has no default.',
      requestBody: { schema: portalSaveVoteSchema },
      responses: [{ status: 200, description: 'Vote saved and recomputed', schema: postResponseSchema }],
      errors: [
        { status: 401, description: 'No portal session', schema: errorSchema },
        { status: 403, description: 'Missing feature, no eligible judging panel, or blocked by a mutation guard', schema: errorSchema },
        { status: 404, description: 'Project not found in the caller scope', schema: errorSchema },
        { status: 409, description: 'Voting is closed (results published)', schema: errorSchema },
        { status: 422, description: 'Validation failed, or a criterion does not apply to the project', schema: errorSchema },
      ],
    },
  },
}
