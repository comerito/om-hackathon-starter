import { resolveApplicableCriteria, type ApplicableCriterionInput } from '../scoring'

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
