import type { CriterionRound, JudgingRound } from '../data/entities'

/**
 * Scoring helpers shared by the judge portal and the scoring routes (SPEC-007).
 *
 * They are pure so the client and the server derive exactly the same numbers — the judge must
 * see the figure that ranks the project, not a client-side approximation of it.
 */

/** The fields `resolveApplicableCriteria` reads; `JudgingCriterion` entities satisfy it as-is. */
export type ApplicableCriterionInput = {
  round: CriterionRound
  trackId?: string | null
  order: number
}

/**
 * Criteria a judge rates for one project in one round, in display order.
 *
 * A criterion applies when it is scoped to this round or to `both`, and when it is global
 * (`trackId` null) or scoped to the project's own track. Replaces the inline
 * `{ $or: [{ round }, { round: 'both' }] }` + track filter in the score-project route.
 * Returns a new array; the input is not reordered.
 */
export function resolveApplicableCriteria<T extends ApplicableCriterionInput>(
  criteria: ReadonlyArray<T>,
  scope: { round: JudgingRound; trackId: string | null | undefined },
): T[] {
  const projectTrackId = scope.trackId ?? null
  return criteria
    .filter((criterion) => criterion.round === scope.round || criterion.round === 'both')
    .filter((criterion) => {
      const criterionTrackId = criterion.trackId ?? null
      return criterionTrackId === null || criterionTrackId === projectTrackId
    })
    .sort((a, b) => a.order - b.order)
}

/** Judges always rate on this many stars; `CriterionScore.scale = 10` marks a star row. */
export const STAR_SCALE = 10

/** Tolerance used when comparing totals, so float-equal totals share a place. */
const RANK_EPSILON = 1e-9

/** Converts a rating on `scale` into the criterion's own points (`7★` on a 5-point criterion → 3.5). */
export function starsToPoints(stars: number, scale: number, maxScore: number): number {
  return (stars / scale) * maxScore
}

/** The criterion fields `computeScore` reads; `JudgingCriterion` entities satisfy it as-is. */
export type ScoringCriterion = {
  id: string
  weight: number
  maxScore: number
}

/** One persisted criterion rating. `scale` null = legacy row whose `score` is on `0…maxScore`. */
export type ScoringRating = {
  criterionId: string
  score: number
  scale: number | null
}

export type ComputeScoreOptions = {
  /** The parent `ProjectScore` was submitted under the old flow: a legacy `0` is a real score. */
  legacySubmitted: boolean
}

/**
 * The `legacySubmitted` flag for a stored `ProjectScore`: submitted now, or voted at some point
 * (`submittedAt` is "first time voted" and survives a recusal or a newly added criterion), so a
 * submitted legacy `0` keeps counting as rated after the vote drops back to in progress.
 */
export function isLegacySubmitted(score: { isSubmitted: boolean; submittedAt?: Date | string | null }): boolean {
  return score.isSubmitted || (score.submittedAt !== null && score.submittedAt !== undefined)
}

export type ScoreSummary = {
  ratedCount: number
  criteriaCount: number
  /** Sum of stars; legacy rows count as their converted (unrounded) star value. */
  starSum: number
  /** Weighted average on 0–10, `null` when nothing is rated. */
  weightedAverage10: number | null
  /** `weightedAverage10 · 10` rounded to 2 decimals, `null` when nothing is rated. */
  totalScore100: number | null
  isComplete: boolean
}

/**
 * Normalised value (0…1) of a rating, or `null` when the rating does not count as rated.
 *
 * - star row (`scale = 10`): rated when the score is 1…10;
 * - legacy row (`scale` null): rated when `score > 0`, or `score = 0` on a submitted vote
 *   (an unsubmitted legacy `0` is an old "not clicked"); unusable when `maxScore <= 0`;
 * - any other scale is not a value this module writes and is ignored.
 */
function normaliseRating(rating: ScoringRating, maxScore: number, legacySubmitted: boolean): number | null {
  if (!Number.isFinite(rating.score)) return null
  if (rating.scale === STAR_SCALE) {
    if (rating.score < 1 || rating.score > STAR_SCALE) return null
    return rating.score / STAR_SCALE
  }
  if (rating.scale === null || rating.scale === undefined) {
    if (!(maxScore > 0)) return null
    if (rating.score < 0) return null
    if (rating.score === 0 && !legacySubmitted) return null
    return rating.score / maxScore
  }
  return null
}

/**
 * Summary of one judge's vote on one project (SPEC-007 Architecture).
 *
 * `applicable` are the already-filtered criteria (see `resolveApplicableCriteria`). Ratings for
 * other criteria are ignored; for duplicate ratings of one criterion the last one wins.
 * `weightedAverage10 = Σ (norm · 10 · w) / Σ w` over rated criteria, falling back to the plain
 * average when their weights sum to 0. With weights adding up to 1 and every criterion rated,
 * `totalScore100` equals the pre-SPEC-007 `Σ (score / maxScore) · weight · 100`.
 */
export function computeScore(
  applicable: ReadonlyArray<ScoringCriterion>,
  ratings: ReadonlyArray<ScoringRating>,
  options: ComputeScoreOptions,
): ScoreSummary {
  const ratingByCriterion = new Map<string, ScoringRating>()
  for (const rating of ratings) ratingByCriterion.set(rating.criterionId, rating)

  let ratedCount = 0
  let starSum = 0
  let weightedSum = 0
  let weightSum = 0
  let plainSum = 0

  for (const criterion of applicable) {
    const rating = ratingByCriterion.get(criterion.id)
    if (!rating) continue
    const norm = normaliseRating(rating, criterion.maxScore, options.legacySubmitted)
    if (norm === null) continue
    const value10 = norm * STAR_SCALE
    const weight = Number.isFinite(criterion.weight) ? criterion.weight : 0
    ratedCount += 1
    starSum += value10
    plainSum += value10
    weightedSum += value10 * weight
    weightSum += weight
  }

  const criteriaCount = applicable.length
  let weightedAverage10: number | null = null
  if (ratedCount > 0) {
    weightedAverage10 = weightSum !== 0 ? weightedSum / weightSum : plainSum / ratedCount
  }
  const totalScore100 = weightedAverage10 === null ? null : Math.round(weightedAverage10 * 10 * 100) / 100

  return {
    ratedCount,
    criteriaCount,
    starSum,
    weightedAverage10,
    totalScore100,
    isComplete: criteriaCount > 0 && ratedCount === criteriaCount,
  }
}

export type LegacyStarsDisplay = {
  /** Stars to render (1…10), or `null` for empty stars. */
  stars: number | null
  /** A submitted legacy `0`: rendered as "0 pts (earlier scale)" and still counted as rated. */
  legacyZero: boolean
}

/** How a legacy (`scale` null) row is shown on the star UI (SPEC-007 Data Model). */
export function legacyStarsForDisplay(score: number, maxScore: number, legacySubmitted: boolean): LegacyStarsDisplay {
  if (score > 0 && maxScore > 0) {
    const stars = Math.min(STAR_SCALE, Math.max(1, Math.round((score / maxScore) * STAR_SCALE)))
    return { stars, legacyZero: false }
  }
  return { stars: null, legacyZero: score === 0 && legacySubmitted }
}

export type RankPlace = { place: number; of: number }

/**
 * Competition ranking (1, 2, 2, 4) of `total` among the judge's `others` voted totals
 * (excluding this project). Totals within 1e-9 of each other tie.
 */
export function rankAmong(total: number, others: ReadonlyArray<number>): RankPlace {
  const higher = others.filter((other) => other - total > RANK_EPSILON).length
  return { place: higher + 1, of: others.length + 1 }
}
