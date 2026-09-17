import {
  STAR_SCALE,
  computeScore,
  isLegacySubmitted,
  legacyStarsForDisplay,
  rankAmong,
  resolveApplicableCriteria,
  starsToPoints,
  type ApplicableCriterionInput,
  type ScoreSummary,
  type ScoringCriterion,
  type ScoringRating,
} from '../scoring'

/**
 * SPEC-007 step 1: the applicable-criteria filter moves out of the score-project route so the
 * POST handler and `my-assignments` count exactly the criteria the judge is shown.
 */

type Criterion = ApplicableCriterionInput & { id: string }

const TRACK_A = 'a0000000-0000-0000-0000-000000000000'
const TRACK_B = 'b0000000-0000-0000-0000-000000000000'

const ids = (criteria: Criterion[]) => criteria.map((criterion) => criterion.id)

describe('resolveApplicableCriteria', () => {
  const CRITERIA: Criterion[] = [
    { id: 'final-only', round: 'final', trackId: null, order: 0 },
    { id: 'both-global', round: 'both', trackId: null, order: 3 },
    { id: 'prelim-global', round: 'preliminary', trackId: null, order: 1 },
    { id: 'prelim-track-a', round: 'preliminary', trackId: TRACK_A, order: 2 },
    { id: 'both-track-b', round: 'both', trackId: TRACK_B, order: 4 },
  ]

  it('keeps criteria for the given round and for both rounds', () => {
    expect(ids(resolveApplicableCriteria(CRITERIA, { round: 'preliminary', trackId: null }))).toEqual([
      'prelim-global',
      'both-global',
    ])
    expect(ids(resolveApplicableCriteria(CRITERIA, { round: 'final', trackId: null }))).toEqual([
      'final-only',
      'both-global',
    ])
  })

  it('keeps global criteria plus the ones scoped to the project track only', () => {
    expect(ids(resolveApplicableCriteria(CRITERIA, { round: 'preliminary', trackId: TRACK_A }))).toEqual([
      'prelim-global',
      'prelim-track-a',
      'both-global',
    ])
    expect(ids(resolveApplicableCriteria(CRITERIA, { round: 'preliminary', trackId: TRACK_B }))).toEqual([
      'prelim-global',
      'both-global',
      'both-track-b',
    ])
  })

  it('treats a project without a track as matching global criteria only', () => {
    expect(ids(resolveApplicableCriteria(CRITERIA, { round: 'final', trackId: undefined }))).toEqual([
      'final-only',
      'both-global',
    ])
  })

  it('treats an undefined criterion trackId like null (entity optional property)', () => {
    const criteria: Criterion[] = [{ id: 'no-track-prop', round: 'both', order: 0 }]
    expect(ids(resolveApplicableCriteria(criteria, { round: 'final', trackId: TRACK_A }))).toEqual(['no-track-prop'])
  })

  it('sorts by order ascending and keeps input order on ties', () => {
    const criteria: Criterion[] = [
      { id: 'c', round: 'both', trackId: null, order: 2 },
      { id: 'a1', round: 'both', trackId: null, order: 0 },
      { id: 'b', round: 'both', trackId: null, order: 1 },
      { id: 'a2', round: 'both', trackId: null, order: 0 },
    ]
    expect(ids(resolveApplicableCriteria(criteria, { round: 'preliminary', trackId: null }))).toEqual([
      'a1',
      'a2',
      'b',
      'c',
    ])
  })

  it('returns a new array and leaves the input untouched', () => {
    const input = [...CRITERIA]
    const result = resolveApplicableCriteria(input, { round: 'preliminary', trackId: TRACK_A })
    expect(result).not.toBe(input)
    expect(ids(input)).toEqual(ids(CRITERIA))
  })

  it('returns an empty array when nothing applies', () => {
    expect(resolveApplicableCriteria([], { round: 'preliminary', trackId: null })).toEqual([])
    const trackOnly: Criterion[] = [{ id: 'x', round: 'final', trackId: TRACK_A, order: 0 }]
    expect(resolveApplicableCriteria(trackOnly, { round: 'final', trackId: TRACK_B })).toEqual([])
    expect(resolveApplicableCriteria(trackOnly, { round: 'preliminary', trackId: TRACK_A })).toEqual([])
  })

  it('preserves the extra fields of the input type', () => {
    const [first] = resolveApplicableCriteria(CRITERIA, { round: 'final', trackId: null })
    expect(first.id).toBe('final-only')
  })
})

/**
 * SPEC-007 step 6: star scoring. Judges rate 1–10 stars; legacy rows (`scale` null) keep their
 * `0…maxScore` value and are read against the current `maxScore`.
 */

const star = (criterionId: string, score: number): ScoringRating => ({ criterionId, score, scale: STAR_SCALE })
const legacy = (criterionId: string, score: number): ScoringRating => ({ criterionId, score, scale: null })

/** The pre-SPEC-007 POST formula, over every criterion, with no `Σ weight` normalisation. */
const todayTotal = (criteria: ScoringCriterion[], scores: Record<string, number>) =>
  Math.round(criteria.reduce((sum, c) => sum + (scores[c.id] / c.maxScore) * c.weight * 100, 0) * 100) / 100

describe('starsToPoints', () => {
  it.each([
    [7, 10, 5, 3.5],
    [10, 10, 10, 10],
    [1, 10, 20, 2],
    [3, 5, 10, 6],
  ])('%p of %p stars on a %p-point criterion is %p points', (stars, scale, maxScore, expected) => {
    expect(starsToPoints(stars, scale, maxScore)).toBeCloseTo(expected, 10)
  })
})

describe('computeScore', () => {
  const EVEN: ScoringCriterion[] = [
    { id: 'a', weight: 0.5, maxScore: 10 },
    { id: 'b', weight: 0.3, maxScore: 10 },
    { id: 'c', weight: 0.2, maxScore: 10 },
  ]

  type Case = {
    name: string
    applicable: ScoringCriterion[]
    ratings: ScoringRating[]
    legacySubmitted?: boolean
    expected: ScoreSummary
  }

  const cases: Case[] = [
    {
      name: 'all-star complete vote',
      applicable: EVEN,
      ratings: [star('a', 8), star('b', 6), star('c', 10)],
      // (8·0.5 + 6·0.3 + 10·0.2) / 1 = 7.8
      expected: { ratedCount: 3, criteriaCount: 3, starSum: 24, weightedAverage10: 7.8, totalScore100: 78, isComplete: true },
    },
    {
      name: 'partial vote averages the rated criteria only',
      applicable: EVEN,
      ratings: [star('a', 8), star('b', 4)],
      // (8·0.5 + 4·0.3) / 0.8 = 6.5
      expected: { ratedCount: 2, criteriaCount: 3, starSum: 12, weightedAverage10: 6.5, totalScore100: 65, isComplete: false },
    },
    {
      name: 'weights not summing to 1 are normalised',
      applicable: [
        { id: 'a', weight: 2, maxScore: 10 },
        { id: 'b', weight: 1, maxScore: 5 },
        { id: 'c', weight: 1, maxScore: 20 },
      ],
      ratings: [star('a', 9), star('b', 5), star('c', 1)],
      // (9·2 + 5·1 + 1·1) / 4 = 6
      expected: { ratedCount: 3, criteriaCount: 3, starSum: 15, weightedAverage10: 6, totalScore100: 60, isComplete: true },
    },
    {
      name: 'Σ weight = 0 falls back to the plain average',
      applicable: [
        { id: 'a', weight: 0, maxScore: 10 },
        { id: 'b', weight: 0, maxScore: 10 },
      ],
      ratings: [star('a', 7), star('b', 4)],
      expected: { ratedCount: 2, criteriaCount: 2, starSum: 11, weightedAverage10: 5.5, totalScore100: 55, isComplete: true },
    },
    {
      name: 'legacy row with maxScore 5 is read on its own scale',
      applicable: [{ id: 'a', weight: 1, maxScore: 5 }],
      ratings: [legacy('a', 4)],
      expected: { ratedCount: 1, criteriaCount: 1, starSum: 8, weightedAverage10: 8, totalScore100: 80, isComplete: true },
    },
    {
      name: 'unsubmitted legacy 0 is not rated',
      applicable: [
        { id: 'a', weight: 0.5, maxScore: 10 },
        { id: 'b', weight: 0.5, maxScore: 10 },
      ],
      ratings: [star('a', 8), legacy('b', 0)],
      legacySubmitted: false,
      expected: { ratedCount: 1, criteriaCount: 2, starSum: 8, weightedAverage10: 8, totalScore100: 80, isComplete: false },
    },
    {
      name: 'submitted legacy 0 is rated and pulls the average down',
      applicable: [
        { id: 'a', weight: 0.5, maxScore: 10 },
        { id: 'b', weight: 0.5, maxScore: 10 },
      ],
      ratings: [star('a', 8), legacy('b', 0)],
      legacySubmitted: true,
      expected: { ratedCount: 2, criteriaCount: 2, starSum: 8, weightedAverage10: 4, totalScore100: 40, isComplete: true },
    },
    {
      name: 'mixed legacy and star rows',
      applicable: [
        { id: 'a', weight: 0.6, maxScore: 5 },
        { id: 'b', weight: 0.4, maxScore: 20 },
      ],
      ratings: [legacy('a', 3), star('b', 9)],
      // legacy 3/5 → 6 stars; (6·0.6 + 9·0.4) / 1 = 7.2
      expected: { ratedCount: 2, criteriaCount: 2, starSum: 15, weightedAverage10: 7.2, totalScore100: 72, isComplete: true },
    },
    {
      name: 'ratings for criteria outside the applicable set are ignored',
      applicable: [{ id: 'a', weight: 1, maxScore: 10 }],
      ratings: [star('a', 6), star('foreign', 10)],
      expected: { ratedCount: 1, criteriaCount: 1, starSum: 6, weightedAverage10: 6, totalScore100: 60, isComplete: true },
    },
    {
      name: 'duplicate ratings: the last one wins',
      applicable: [{ id: 'a', weight: 1, maxScore: 10 }],
      ratings: [star('a', 2), star('a', 9)],
      expected: { ratedCount: 1, criteriaCount: 1, starSum: 9, weightedAverage10: 9, totalScore100: 90, isComplete: true },
    },
    {
      name: 'empty applicable set',
      applicable: [],
      ratings: [star('a', 6)],
      expected: { ratedCount: 0, criteriaCount: 0, starSum: 0, weightedAverage10: null, totalScore100: null, isComplete: false },
    },
    {
      name: 'nothing rated yet',
      applicable: EVEN,
      ratings: [],
      expected: { ratedCount: 0, criteriaCount: 3, starSum: 0, weightedAverage10: null, totalScore100: null, isComplete: false },
    },
    {
      name: 'legacy row on a criterion with maxScore 0 is not rated',
      applicable: [{ id: 'a', weight: 1, maxScore: 0 }],
      ratings: [legacy('a', 3)],
      legacySubmitted: true,
      expected: { ratedCount: 0, criteriaCount: 1, starSum: 0, weightedAverage10: null, totalScore100: null, isComplete: false },
    },
    {
      name: 'star row outside 1…10 is not rated',
      applicable: [
        { id: 'a', weight: 1, maxScore: 10 },
        { id: 'b', weight: 1, maxScore: 10 },
      ],
      ratings: [star('a', 0), star('b', 11)],
      expected: { ratedCount: 0, criteriaCount: 2, starSum: 0, weightedAverage10: null, totalScore100: null, isComplete: false },
    },
  ]

  it.each(cases)('$name', ({ applicable, ratings, legacySubmitted = false, expected }) => {
    const result = computeScore(applicable, ratings, { legacySubmitted })
    expect(result.ratedCount).toBe(expected.ratedCount)
    expect(result.criteriaCount).toBe(expected.criteriaCount)
    expect(result.isComplete).toBe(expected.isComplete)
    expect(result.starSum).toBeCloseTo(expected.starSum, 9)
    expect(result.totalScore100).toBe(expected.totalScore100)
    if (expected.weightedAverage10 === null) expect(result.weightedAverage10).toBeNull()
    else expect(result.weightedAverage10).toBeCloseTo(expected.weightedAverage10, 9)
  })

  it.each([
    { weights: [0.5, 0.3, 0.2], stars: [8, 6, 10] },
    { weights: [0.25, 0.25, 0.5], stars: [3, 7, 9] },
    { weights: [0.1, 0.2, 0.3, 0.4], stars: [10, 1, 5, 7] },
    { weights: [0.35, 0.65], stars: [4, 6] },
    { weights: [1], stars: [7] },
  ])('weights adding up to 1 reproduce today\'s total ($weights / $stars)', ({ weights, stars }) => {
    const criteria = weights.map((weight, i) => ({ id: `c${i}`, weight, maxScore: 10 }))
    const scores = Object.fromEntries(stars.map((value, i) => [`c${i}`, value]))
    const result = computeScore(
      criteria,
      stars.map((value, i) => star(`c${i}`, value)),
      { legacySubmitted: false },
    )
    expect(result.totalScore100).toBe(todayTotal(criteria, scores))
  })

  it('reproduces today\'s total for legacy rows when weights add up to 1', () => {
    const criteria = [
      { id: 'a', weight: 0.4, maxScore: 5 },
      { id: 'b', weight: 0.6, maxScore: 20 },
    ]
    const result = computeScore(criteria, [legacy('a', 3), legacy('b', 13)], { legacySubmitted: true })
    expect(result.totalScore100).toBe(todayTotal(criteria, { a: 3, b: 13 }))
  })
})

describe('legacyStarsForDisplay', () => {
  it.each([
    { score: 4, maxScore: 5, submitted: false, expected: { stars: 8, legacyZero: false } },
    { score: 1, maxScore: 100, submitted: true, expected: { stars: 1, legacyZero: false } },
    { score: 13, maxScore: 20, submitted: false, expected: { stars: 7, legacyZero: false } },
    { score: 12, maxScore: 10, submitted: true, expected: { stars: 10, legacyZero: false } },
    { score: 0, maxScore: 10, submitted: true, expected: { stars: null, legacyZero: true } },
    { score: 0, maxScore: 10, submitted: false, expected: { stars: null, legacyZero: false } },
  ])('score $score / $maxScore (submitted: $submitted)', ({ score, maxScore, submitted, expected }) => {
    expect(legacyStarsForDisplay(score, maxScore, submitted)).toEqual(expected)
  })
})

describe('rankAmong', () => {
  it.each([
    { name: 'single voted project', total: 70, others: [], expected: { place: 1, of: 1 } },
    { name: 'highest', total: 90, others: [80, 70], expected: { place: 1, of: 3 } },
    { name: 'tie shares the place', total: 80, others: [90, 80, 70], expected: { place: 2, of: 4 } },
    { name: 'after a tie the place skips', total: 70, others: [90, 80, 80], expected: { place: 4, of: 4 } },
    { name: 'all tied', total: 50, others: [50, 50], expected: { place: 1, of: 3 } },
    { name: 'float-equal totals tie', total: 0.3, others: [0.1 + 0.2], expected: { place: 1, of: 2 } },
  ])('$name', ({ total, others, expected }) => {
    expect(rankAmong(total, others)).toEqual(expected)
  })
})

describe('isLegacySubmitted', () => {
  it('is true for a submitted score or one that was voted before', () => {
    expect(isLegacySubmitted({ isSubmitted: true, submittedAt: null })).toBe(true)
    expect(isLegacySubmitted({ isSubmitted: false, submittedAt: new Date('2026-01-01T00:00:00Z') })).toBe(true)
  })

  it('is false for a score that was never voted', () => {
    expect(isLegacySubmitted({ isSubmitted: false, submittedAt: null })).toBe(false)
    expect(isLegacySubmitted({ isSubmitted: false })).toBe(false)
  })
})
