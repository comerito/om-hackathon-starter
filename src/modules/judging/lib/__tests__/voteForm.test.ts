import { computeScore } from '../scoring'
import {
  clampStars,
  formatPoints,
  formatWeightPercent,
  initialVoteState,
  placeAmongMyVotes,
  ratingsForCompute,
  summarizeVote,
  withNote,
  withStars,
  type PlaceScore,
  type VoteFormCriterion,
  type VoteFormScore,
} from '../voteForm'

/** SPEC-007 step 8: client-side vote state behind `StarCriterionCard` and `VoteSummary`. */

const criterion = (id: string, maxScore: number, weight: number, order = 0): VoteFormCriterion => ({
  id, name: id, description: null, max_score: maxScore, weight, order, round: 'both',
})

const CRITERIA: VoteFormCriterion[] = [
  criterion('innovation', 5, 0.5, 0),
  criterion('execution', 10, 0.3, 1),
  criterion('pitch', 20, 0.2, 2),
]

const score = (overrides: Partial<VoteFormScore> = {}): VoteFormScore => ({
  id: 'score-1',
  total_score: null,
  comment: null,
  private_notes: null,
  conflict_of_interest: false,
  is_submitted: false,
  submitted_at: null,
  criterion_scores: [],
  ...overrides,
})

describe('clampStars', () => {
  it.each([
    [0, 1], [-3, 1], [1, 1], [7, 7], [10, 10], [11, 10], [6.6, 7], [Number.NaN, 1], [Number.POSITIVE_INFINITY, 1],
  ])('clamps %p to %p', (input, expected) => {
    expect(clampStars(input)).toBe(expected)
  })
})

describe('formatPoints', () => {
  it.each([
    [3.5, '3.5'], [4, '4'], [31, '31'], [2.349, '2.3'], [2.35, '2.4'], [0, '0'], [-0.01, '0'], [Number.NaN, '0'],
  ])('formats %p as %p', (input, expected) => {
    expect(formatPoints(input)).toBe(expected)
  })

  it('formats weights as whole percentages', () => {
    expect(formatWeightPercent(0.25)).toBe('25')
    expect(formatWeightPercent(1 / 3)).toBe('33')
    expect(formatWeightPercent(Number.NaN)).toBe('0')
  })
})

describe('initialVoteState', () => {
  it('shows nothing rated without a persisted score', () => {
    const state = initialVoteState(CRITERIA, null)
    expect(Object.keys(state)).toEqual(['innovation', 'execution', 'pitch'])
    expect(state.innovation).toEqual({ stars: null, legacyZero: false, legacy: false, starsEdited: false, note: '' })
  })

  it('reads star rows, treats note-only placeholders as not rated and keeps notes', () => {
    const state = initialVoteState(CRITERIA, score({
      criterion_scores: [
        { criterion_id: 'innovation', score: 7, scale: 10, note: 'solid' },
        { criterion_id: 'execution', score: 0, scale: 10, note: 'ask about tests' },
      ],
    }))
    expect(state.innovation).toMatchObject({ stars: 7, legacy: false, note: 'solid' })
    expect(state.execution).toMatchObject({ stars: null, legacyZero: false, note: 'ask about tests' })
    expect(state.pitch).toMatchObject({ stars: null, note: '' })
  })

  it('converts legacy rows and distinguishes submitted from unsubmitted legacy zeros', () => {
    const legacyRows = [
      { criterion_id: 'innovation', score: 3, scale: null, note: null },
      { criterion_id: 'execution', score: 0, scale: null, note: null },
    ]
    const draft = initialVoteState(CRITERIA, score({ criterion_scores: legacyRows }))
    expect(draft.innovation).toMatchObject({ stars: 6, legacy: true, legacyZero: false })
    expect(draft.execution).toMatchObject({ stars: null, legacy: false, legacyZero: false })

    const submitted = initialVoteState(CRITERIA, score({ is_submitted: true, criterion_scores: legacyRows }))
    expect(submitted.execution).toMatchObject({ stars: null, legacy: true, legacyZero: true })

    const onceVoted = initialVoteState(CRITERIA, score({ submitted_at: '2026-09-01T10:00:00Z', criterion_scores: legacyRows }))
    expect(onceVoted.execution.legacyZero).toBe(true)
  })
})

describe('withStars / withNote', () => {
  it('marks a clicked criterion as a star rating and clears the legacy flags', () => {
    const base = initialVoteState(CRITERIA, score({
      is_submitted: true,
      criterion_scores: [{ criterion_id: 'execution', score: 0, scale: null, note: 'n' }],
    }))
    const next = withStars(base, 'execution', 0)
    expect(next.execution).toEqual({ stars: 1, legacyZero: false, legacy: false, starsEdited: true, note: 'n' })
    expect(base.execution.legacyZero).toBe(true)
    expect(withNote(next, 'execution', 'updated').execution).toMatchObject({ stars: 1, note: 'updated' })
  })
})

describe('ratingsForCompute', () => {
  it('uses clicked stars and keeps untouched persisted rows raw', () => {
    const persisted = score({
      criterion_scores: [
        { criterion_id: 'innovation', score: 3, scale: null, note: null },
        { criterion_id: 'execution', score: 4, scale: null, note: null },
        { criterion_id: 'pitch', score: 0, scale: 10, note: 'placeholder' },
      ],
    })
    const state = withStars(initialVoteState(CRITERIA, persisted), 'execution', 9)
    expect(ratingsForCompute(state, persisted)).toEqual([
      { criterionId: 'execution', score: 9, scale: 10 },
      { criterionId: 'innovation', score: 3, scale: null },
      { criterionId: 'pitch', score: 0, scale: 10 },
    ])
  })

  it('keeps the raw legacy value even when it displays as rounded stars', () => {
    const persisted = score({ criterion_scores: [{ criterion_id: 'pitch', score: 13, scale: null, note: null }] })
    const state = initialVoteState(CRITERIA, persisted)
    expect(state.pitch.stars).toBe(7)
    const summary = summarizeVote(CRITERIA, state, persisted)
    expect(summary.starSum).toBeCloseTo(6.5)
  })
})

describe('summarizeVote', () => {
  it('matches computeScore over the same star ratings', () => {
    let state = initialVoteState(CRITERIA, null)
    state = withStars(state, 'innovation', 8)
    state = withStars(state, 'execution', 6)
    const partial = summarizeVote(CRITERIA, state, null)
    expect(partial).toEqual(computeScore(
      CRITERIA.map((c) => ({ id: c.id, weight: c.weight, maxScore: c.max_score })),
      [
        { criterionId: 'innovation', score: 8, scale: 10 },
        { criterionId: 'execution', score: 6, scale: 10 },
      ],
      { legacySubmitted: false },
    ))
    expect(partial).toMatchObject({ ratedCount: 2, criteriaCount: 3, starSum: 14, isComplete: false })

    state = withStars(state, 'pitch', 5)
    const full = summarizeVote(CRITERIA, state, null)
    expect(full.isComplete).toBe(true)
    expect(full.weightedAverage10).toBeCloseTo(8 * 0.5 + 6 * 0.3 + 5 * 0.2)
  })

  it('counts a submitted legacy zero as rated', () => {
    const persisted = score({
      is_submitted: true,
      criterion_scores: [
        { criterion_id: 'innovation', score: 0, scale: null, note: null },
        { criterion_id: 'execution', score: 10, scale: null, note: null },
        { criterion_id: 'pitch', score: 20, scale: null, note: null },
      ],
    })
    const summary = summarizeVote(CRITERIA, withStars(initialVoteState(CRITERIA, persisted), 'pitch', 4), persisted)
    expect(summary).toMatchObject({ ratedCount: 3, isComplete: true, starSum: 14 })
  })
})

describe('placeAmongMyVotes', () => {
  const project = { id: 'p-current', track_id: 'track-a' }
  const vote = (overrides: Partial<PlaceScore> & { project_id: string }): PlaceScore => ({
    is_submitted: true, conflict_of_interest: false, track_id: 'track-a', weighted_average: 5, ...overrides,
  })
  const MY_SCORES: PlaceScore[] = [
    vote({ project_id: 'p1', weighted_average: 8 }),
    vote({ project_id: 'p2', weighted_average: 6.8 }),
    vote({ project_id: 'p3', weighted_average: 4 }),
    vote({ project_id: 'p-current', weighted_average: 9.9 }),
    vote({ project_id: 'draft', is_submitted: false, weighted_average: 9 }),
    vote({ project_id: 'recused', conflict_of_interest: true, weighted_average: 9 }),
    vote({ project_id: 'other-track', track_id: 'track-b', weighted_average: 9 }),
    vote({ project_id: 'no-average', weighted_average: null }),
  ]
  const live = (weightedAverage10: number | null, isComplete = true, recused = false) => ({
    summary: { weightedAverage10, isComplete }, recused,
  })

  it('ranks the live average among voted projects of the same track, ties sharing a place', () => {
    expect(placeAmongMyVotes(project, MY_SCORES, live(7))).toEqual({ place: 2, of: 4 })
    expect(placeAmongMyVotes(project, MY_SCORES, live(6.8))).toEqual({ place: 2, of: 4 })
    expect(placeAmongMyVotes(project, MY_SCORES, live(9))).toEqual({ place: 1, of: 4 })
    expect(placeAmongMyVotes(project, [], live(3))).toEqual({ place: 1, of: 1 })
  })

  it('is null until the current vote is complete and not recused', () => {
    expect(placeAmongMyVotes(project, MY_SCORES, live(7, false))).toBeNull()
    expect(placeAmongMyVotes(project, MY_SCORES, live(7, true, true))).toBeNull()
    expect(placeAmongMyVotes(project, MY_SCORES, live(null))).toBeNull()
  })

  it('compares only votes from the same round when a round is given', () => {
    const scores = [vote({ project_id: 'p1', weighted_average: 8, round: 'final' }), vote({ project_id: 'p2', weighted_average: 8, round: 'preliminary' })]
    expect(placeAmongMyVotes(project, scores, { ...live(7), round: 'preliminary' })).toEqual({ place: 2, of: 2 })
  })
})
