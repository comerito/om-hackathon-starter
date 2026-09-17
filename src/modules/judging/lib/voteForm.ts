import type { JudgeAssignmentScore } from './judgeAssignments'
import {
  STAR_SCALE,
  computeScore,
  isLegacySubmitted,
  legacyStarsForDisplay,
  rankAmong,
  type RankPlace,
  type ScoreSummary,
  type ScoringRating,
} from './scoring'

/**
 * Client-side state of the star voting page (SPEC-007 phase 2).
 *
 * Pure helpers shared by `StarCriterionCard`, `VoteSummary` and the voting page, so the live
 * summary is derived with the same `computeScore` the server uses. Types only from `scoring.ts`
 * and `judgeAssignments.ts` — nothing here may pull entity code into the bundle.
 */

/** One applicable criterion as returned by `GET /api/judging/portal/score-project`. */
export type VoteFormCriterion = {
  id: string
  name: string
  description: string | null
  max_score: number
  weight: number
  order: number
  round: string
}

/** One persisted criterion rating. `scale` null = legacy row; `scale = 10, score = 0` = note-only placeholder. */
export type VoteFormCriterionScore = {
  criterion_id: string
  score: number
  scale: number | null
  note: string | null
}

/** The judge's persisted `ProjectScore` as returned by `GET /api/judging/portal/score-project`. */
export type VoteFormScore = {
  id: string
  total_score: number | null
  comment: string | null
  private_notes: string | null
  conflict_of_interest: boolean
  is_submitted: boolean
  submitted_at: string | null
  criterion_scores: VoteFormCriterionScore[]
}

export type CriterionVoteState = {
  /** Stars shown (1…10), `null` = not rated (empty stars). */
  stars: number | null
  /** A submitted legacy `0`: empty stars with the "0 pts (earlier scale)" hint, still rated. */
  legacyZero: boolean
  /** The rating still comes from a legacy (`scale` null) row the judge has not re-rated. */
  legacy: boolean
  /** The judge clicked stars on this page, so the value is a star rating regardless of the stored row. */
  starsEdited: boolean
  note: string
}

/** Per-criterion state keyed by criterion id. */
export type VoteFormState = Record<string, CriterionVoteState>

/** Clamps any `Rating` output to a whole 1…10 star value (its `ArrowLeft` can reach `0`). */
export function clampStars(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(STAR_SCALE, Math.max(1, Math.round(value)))
}

/** Points / star sums with at most one decimal and no trailing zero (`3.5`, `4`, `31`). */
export function formatPoints(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 10) / 10
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

/** A criterion weight (0…1) as a whole percentage (`0.25` → `"25"`). */
export function formatWeightPercent(weight: number): string {
  if (!Number.isFinite(weight)) return '0'
  return formatPoints(Math.round(weight * 100))
}

function persistedLegacySubmitted(score: VoteFormScore | null | undefined): boolean {
  if (!score) return false
  return isLegacySubmitted({ isSubmitted: score.is_submitted, submittedAt: score.submitted_at })
}

/**
 * Initial per-criterion state from the persisted vote (SPEC-007 Data Model, legacy display):
 * star rows show their stars, note-only placeholders (`scale = 10, score = 0`) and missing rows
 * are not rated, and legacy rows go through `legacyStarsForDisplay`.
 */
export function initialVoteState(
  criteria: ReadonlyArray<Pick<VoteFormCriterion, 'id' | 'max_score'>>,
  score: VoteFormScore | null | undefined,
): VoteFormState {
  const legacySubmitted = persistedLegacySubmitted(score)
  const rows = new Map<string, VoteFormCriterionScore>()
  for (const row of score?.criterion_scores ?? []) rows.set(row.criterion_id, row)

  const state: VoteFormState = {}
  for (const criterion of criteria) {
    const row = rows.get(criterion.id)
    const note = row?.note ?? ''
    if (!row || !Number.isFinite(row.score)) {
      state[criterion.id] = { stars: null, legacyZero: false, legacy: false, starsEdited: false, note }
      continue
    }
    if (row.scale === null || row.scale === undefined) {
      const display = legacyStarsForDisplay(row.score, criterion.max_score, legacySubmitted)
      state[criterion.id] = {
        stars: display.stars,
        legacyZero: display.legacyZero,
        legacy: display.stars !== null || display.legacyZero,
        starsEdited: false,
        note,
      }
      continue
    }
    const rated = row.scale === STAR_SCALE && row.score >= 1 && row.score <= STAR_SCALE
    state[criterion.id] = {
      stars: rated ? clampStars(row.score) : null,
      legacyZero: false,
      legacy: false,
      starsEdited: false,
      note,
    }
  }
  return state
}

const EMPTY_CRITERION_STATE: CriterionVoteState = {
  stars: null, legacyZero: false, legacy: false, starsEdited: false, note: '',
}

/** Returns a new state with the clicked stars on one criterion (clamped, marked as a star rating). */
export function withStars(state: VoteFormState, criterionId: string, stars: number): VoteFormState {
  const current = state[criterionId] ?? EMPTY_CRITERION_STATE
  return {
    ...state,
    [criterionId]: { ...current, stars: clampStars(stars), legacyZero: false, legacy: false, starsEdited: true },
  }
}

/** Returns a new state with the note of one criterion replaced. */
export function withNote(state: VoteFormState, criterionId: string, note: string): VoteFormState {
  const current = state[criterionId] ?? EMPTY_CRITERION_STATE
  return { ...state, [criterionId]: { ...current, note } }
}

/**
 * Ratings to feed `computeScore` for the live summary: criteria clicked on this page become
 * star ratings (`{ score: stars, scale: 10 }`, exactly what the server will store), every other
 * criterion keeps its persisted raw row, so an untouched legacy value is not re-rounded.
 */
export function ratingsForCompute(
  state: VoteFormState,
  persistedScore: VoteFormScore | null | undefined,
): ScoringRating[] {
  const ratings: ScoringRating[] = []
  const edited = new Set<string>()
  for (const [criterionId, entry] of Object.entries(state)) {
    if (!entry.starsEdited || entry.stars === null) continue
    edited.add(criterionId)
    ratings.push({ criterionId, score: entry.stars, scale: STAR_SCALE })
  }
  for (const row of persistedScore?.criterion_scores ?? []) {
    if (edited.has(row.criterion_id)) continue
    ratings.push({ criterionId: row.criterion_id, score: row.score, scale: row.scale ?? null })
  }
  return ratings
}

/** Live summary of the vote on the page, computed exactly as the server recomputes it. */
export function summarizeVote(
  criteria: ReadonlyArray<Pick<VoteFormCriterion, 'id' | 'weight' | 'max_score'>>,
  state: VoteFormState,
  persistedScore: VoteFormScore | null | undefined,
): ScoreSummary {
  return computeScore(
    criteria.map((criterion) => ({ id: criterion.id, weight: criterion.weight, maxScore: criterion.max_score })),
    ratingsForCompute(state, persistedScore),
    { legacySubmitted: persistedLegacySubmitted(persistedScore) },
  )
}

export type PlaceProject = { id: string; track_id: string | null }

export type PlaceScore = Pick<
  JudgeAssignmentScore,
  'project_id' | 'is_submitted' | 'conflict_of_interest' | 'track_id' | 'weighted_average'
> & { round?: string }

export type LiveVote = {
  summary: Pick<ScoreSummary, 'isComplete' | 'weightedAverage10'>
  recused: boolean
  /** When set, only the judge's votes in this round are compared. */
  round?: string
}

/**
 * Place of the current project among this judge's voted projects in the same track (SPEC-007
 * phase 2), using the live weighted average for the current project and the `my-assignments`
 * weighted averages for the others. `null` until the current vote is complete and not recused.
 */
export function placeAmongMyVotes(
  currentProject: PlaceProject,
  myScores: ReadonlyArray<PlaceScore>,
  live: LiveVote,
): RankPlace | null {
  const liveAverage = live.summary.weightedAverage10
  if (live.recused || !live.summary.isComplete || liveAverage === null || !Number.isFinite(liveAverage)) {
    return null
  }
  const others: number[] = []
  for (const score of myScores) {
    if (score.project_id === currentProject.id) continue
    if (!score.is_submitted || score.conflict_of_interest) continue
    if (score.track_id !== currentProject.track_id) continue
    if (live.round !== undefined && score.round !== undefined && score.round !== live.round) continue
    if (typeof score.weighted_average !== 'number' || !Number.isFinite(score.weighted_average)) continue
    others.push(score.weighted_average)
  }
  return rankAmong(liveAverage, others)
}
