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
