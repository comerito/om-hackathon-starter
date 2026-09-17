import type { JudgingRound } from '../data/entities'
import { areResultsPublished } from './resultsScope'
import {
  computeScore,
  isLegacySubmitted,
  resolveApplicableCriteria,
  type ApplicableCriterionInput,
  type ScoringCriterion,
  type ScoringRating,
} from './scoring'

/**
 * Recomputes a competition's judge scores after an admin adds, edits or deletes a criterion
 * (SPEC-007 step 7b, Edge Cases "Admin adds or deletes a criterion").
 *
 * The recompute rule is the portal vote write's (`portalVote.ts`, phase 3): totals come from
 * `computeScore` over the applicable criteria, a score is voted once every applicable criterion
 * is rated, `submittedAt` is "first time voted" and never cleared, and a recused score keeps a
 * null total. Written against the `CriteriaRecomputeStore` port so it is testable without a
 * database; `criteriaRecomputeStore.ts` is the MikroORM 7 implementation.
 */

export type RecomputeScope = { tenantId: string; organizationId: string }

export type CriterionChangeScope = RecomputeScope & { competitionId: string }

/** A criterion as the recompute reads it; `JudgingCriterion` entities satisfy it as-is. */
export type RecomputeCriterion = ApplicableCriterionInput & ScoringCriterion

/** The `ProjectScore` fields the recompute reads and writes; the entity satisfies it as-is. */
export type RecomputeScoreRecord = {
  id: string
  projectId: string
  round: JudgingRound
  conflictOfInterest: boolean
  isSubmitted: boolean
  submittedAt?: Date | null
  totalScore?: number | null
}

export type RecomputeRating = ScoringRating & { projectScoreId: string }

export type ScoreRecomputePatch = {
  isSubmitted: boolean
  totalScore: number | null
  submittedAt: Date | null
}

export type CriteriaRecomputeStore = {
  /**
   * Competition and tenant scope of a criterion, soft-deleted rows included. Each `hint` field
   * that is set narrows the lookup, so a payload cannot point at another tenant's criterion.
   */
  findCriterionScope(criterionId: string, hint: Partial<RecomputeScope>): Promise<CriterionChangeScope | null>
  /** Runs the phases in ONE transaction, flushing after each phase (`withAtomicFlush`). */
  atomic(phases: Array<() => Promise<void>>): Promise<void>
  /** Every score of the competition, loaded with `SELECT … FOR UPDATE`. */
  lockScores(competitionId: string, scope: RecomputeScope): Promise<RecomputeScoreRecord[]>
  /** Current stage, read inside the transaction; `null` when the competition is not found. */
  readCompetitionStage(competitionId: string, scope: RecomputeScope): Promise<string | null>
  /** Live (not soft-deleted) criteria of the competition. */
  loadCriteria(competitionId: string, scope: RecomputeScope): Promise<RecomputeCriterion[]>
  /** `projectId → trackId` for the given projects. Callers never pass an empty list. */
  loadProjectTracks(projectIds: ReadonlyArray<string>, scope: RecomputeScope): Promise<Map<string, string | null>>
  /** Every criterion row of the given scores. Callers never pass an empty list. */
  loadRatings(scoreIds: ReadonlyArray<string>, scope: RecomputeScope): Promise<RecomputeRating[]>
  /** Applies the patch to the managed record; persisted by the phase flush. */
  patchScore(record: RecomputeScoreRecord, patch: ScoreRecomputePatch): void
}

/** The fields read from a `judging.criterion.*` event payload (`criterionCrudEvents.buildPayload`). */
export type CriterionChangePayload = {
  id?: unknown
  competitionId?: unknown
  tenantId?: unknown
  organizationId?: unknown
}

export type CriteriaRecomputeOutcome =
  | { status: 'skipped'; reason: 'missing_scope' | 'competition_not_found' | 'results_published'; competitionId: string | null }
  | { status: 'recomputed'; competitionId: string; scoreCount: number; changedCount: number }

export type PlannedScorePatch = { score: RecomputeScoreRecord; patch: ScoreRecomputePatch }

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function sameInstant(a: Date | null | undefined, b: Date | null | undefined): boolean {
  const left = a ? new Date(a).getTime() : null
  const right = b ? new Date(b).getTime() : null
  return left === right
}

/**
 * The patches that bring each score in line with the current criteria. Only scores whose
 * `isSubmitted`, `totalScore` or `submittedAt` actually change are returned; scores whose project
 * is unknown (no track to resolve criteria against) are left alone.
 */
export function planScoreRecompute(input: {
  criteria: ReadonlyArray<RecomputeCriterion>
  scores: ReadonlyArray<RecomputeScoreRecord>
  projectTracks: ReadonlyMap<string, string | null>
  ratings: ReadonlyArray<RecomputeRating>
  now: Date
}): PlannedScorePatch[] {
  const ratingsByScore = new Map<string, ScoringRating[]>()
  for (const rating of input.ratings) {
    const list = ratingsByScore.get(rating.projectScoreId) ?? []
    list.push({ criterionId: rating.criterionId, score: rating.score, scale: rating.scale })
    ratingsByScore.set(rating.projectScoreId, list)
  }

  const planned: PlannedScorePatch[] = []
  for (const score of input.scores) {
    if (!input.projectTracks.has(score.projectId)) continue
    const trackId = input.projectTracks.get(score.projectId) ?? null
    const applicable = resolveApplicableCriteria(input.criteria, { round: score.round, trackId })
    const summary = computeScore(applicable, ratingsByScore.get(score.id) ?? [], {
      legacySubmitted: isLegacySubmitted(score),
    })
    const currentSubmittedAt = score.submittedAt ?? null
    const patch: ScoreRecomputePatch = score.conflictOfInterest
      ? { isSubmitted: false, totalScore: null, submittedAt: currentSubmittedAt }
      : {
        isSubmitted: summary.isComplete,
        totalScore: summary.totalScore100,
        submittedAt: currentSubmittedAt ?? (summary.isComplete ? input.now : null),
      }
    const unchanged = patch.isSubmitted === score.isSubmitted
      && patch.totalScore === (score.totalScore ?? null)
      && sameInstant(patch.submittedAt, currentSubmittedAt)
    if (!unchanged) planned.push({ score, patch })
  }
  return planned
}

/** Competition and tenant scope of the changed criterion, from the payload or the criterion row. */
export async function resolveCriterionChangeScope(
  store: Pick<CriteriaRecomputeStore, 'findCriterionScope'>,
  payload: CriterionChangePayload,
): Promise<CriterionChangeScope | null> {
  const competitionId = nonEmptyString(payload.competitionId)
  const tenantId = nonEmptyString(payload.tenantId)
  const organizationId = nonEmptyString(payload.organizationId)
  if (competitionId && tenantId && organizationId) return { competitionId, tenantId, organizationId }

  const criterionId = nonEmptyString(payload.id)
  if (!criterionId) return null
  const hint: Partial<RecomputeScope> = {}
  if (tenantId) hint.tenantId = tenantId
  if (organizationId) hint.organizationId = organizationId
  const found = await store.findCriterionScope(criterionId, hint)
  if (!found) return null
  if (competitionId && competitionId !== found.competitionId) return null
  return found
}

function chunk<T>(items: ReadonlyArray<T>, size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

/** Keeps each `IN (…)` list at a sane length on large competitions. */
export const RECOMPUTE_IN_CHUNK = 500

/**
 * Recomputes every score of the competition the changed criterion belongs to, all rounds, in one
 * transaction: lock the scores, re-check the stage under the lock (published → no writes), read
 * criteria/projects/ratings, then patch the changed scores in a separate phase (one flush).
 * Emits no events — one per score would flood the client broadcast.
 */
export async function recomputeScoresForCriterionChange(
  store: CriteriaRecomputeStore,
  payload: CriterionChangePayload,
  options: { now?: () => Date } = {},
): Promise<CriteriaRecomputeOutcome> {
  const target = await resolveCriterionChangeScope(store, payload)
  if (!target) return { status: 'skipped', reason: 'missing_scope', competitionId: null }

  const { competitionId } = target
  const scope: RecomputeScope = { tenantId: target.tenantId, organizationId: target.organizationId }
  const now = (options.now ?? (() => new Date()))()
  const state: {
    skipped: 'competition_not_found' | 'results_published' | null
    scoreCount: number
    planned: PlannedScorePatch[]
  } = { skipped: null, scoreCount: 0, planned: [] }

  await store.atomic([
    // Phase 1 — reads only: lock, stage re-check under the lock, and the recompute inputs.
    async () => {
      const scores = await store.lockScores(competitionId, scope)
      const stage = await store.readCompetitionStage(competitionId, scope)
      if (stage === null) {
        state.skipped = 'competition_not_found'
        return
      }
      if (areResultsPublished(stage)) {
        state.skipped = 'results_published'
        return
      }
      state.scoreCount = scores.length
      if (scores.length === 0) return

      const criteria = await store.loadCriteria(competitionId, scope)
      const projectIds = [...new Set(scores.map((score) => score.projectId))]
      const projectTracks = new Map<string, string | null>()
      for (const ids of chunk(projectIds, RECOMPUTE_IN_CHUNK)) {
        for (const [projectId, trackId] of await store.loadProjectTracks(ids, scope)) projectTracks.set(projectId, trackId)
      }
      const ratings: RecomputeRating[] = []
      for (const ids of chunk(scores.map((score) => score.id), RECOMPUTE_IN_CHUNK)) {
        ratings.push(...(await store.loadRatings(ids, scope)))
      }
      state.planned = planScoreRecompute({ criteria, scores, projectTracks, ratings, now })
    },
    // Phase 2 — mutations only, flushed once by `atomic`.
    async () => {
      for (const { score, patch } of state.planned) store.patchScore(score, patch)
    },
  ])

  if (state.skipped) return { status: 'skipped', reason: state.skipped, competitionId }
  return { status: 'recomputed', competitionId, scoreCount: state.scoreCount, changedCount: state.planned.length }
}
