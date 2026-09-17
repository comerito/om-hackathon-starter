import type { DemoStatus } from '../../data/entities'
import {
  filterQueueEntries, findOnStage, findUpNext, formatVoteScore, formatWeightedAverage, isDone, queueProgress, resolveQueueEntries,
  sortByDemoOrder, voteState, type VoteState,
} from '../votingQueue'

/**
 * SPEC-007 step 1: the judge portal list becomes a voting queue in presentation order, with
 * vote badges derived from the stored score flags and the on-stage / up-next teams marked.
 */

type Project = { id: string; title: string; demo: { order: number; status: DemoStatus } | null }

const project = (id: string, title: string, demo: Project['demo'] = null): Project => ({ id, title, demo })
const ids = (projects: Project[]) => projects.map((p) => p.id)

describe('sortByDemoOrder', () => {
  it('orders projects by demo slot order ascending', () => {
    const projects = [
      project('c', 'Gamma', { order: 2, status: 'queued' }),
      project('a', 'Alpha', { order: 0, status: 'completed' }),
      project('b', 'Beta', { order: 1, status: 'presenting' }),
    ]
    expect(ids(sortByDemoOrder(projects))).toEqual(['a', 'b', 'c'])
  })

  it('puts projects without a demo slot last, alphabetically by title', () => {
    const projects = [
      project('no-slot-z', 'Zeta'),
      project('slot-5', 'Omega', { order: 5, status: 'queued' }),
      project('no-slot-a', 'alpha'),
      project('slot-0', 'Yak', { order: 0, status: 'queued' }),
      project('no-slot-m', 'Mu'),
    ]
    expect(ids(sortByDemoOrder(projects))).toEqual(['slot-0', 'slot-5', 'no-slot-a', 'no-slot-m', 'no-slot-z'])
  })

  it('breaks ties in slot order by title', () => {
    const projects = [
      project('beta', 'Beta', { order: 1, status: 'queued' }),
      project('alpha', 'Alpha', { order: 1, status: 'queued' }),
      project('first', 'Zulu', { order: 0, status: 'queued' }),
    ]
    expect(ids(sortByDemoOrder(projects))).toEqual(['first', 'alpha', 'beta'])
  })

  it('returns a new array and leaves the input untouched', () => {
    const projects = [project('b', 'B', { order: 1, status: 'queued' }), project('a', 'A', { order: 0, status: 'queued' })]
    const sorted = sortByDemoOrder(projects)
    expect(sorted).not.toBe(projects)
    expect(ids(projects)).toEqual(['b', 'a'])
  })

  it('handles empty input and a queue with no slots at all', () => {
    expect(sortByDemoOrder([])).toEqual([])
    expect(ids(sortByDemoOrder([project('b', 'Beta'), project('a', 'Alpha')]))).toEqual(['a', 'b'])
  })
})

describe('voteState — Phase 1, stored flags only', () => {
  it('is not voted when the judge has no score row', () => {
    expect(voteState(null)).toBe('not_voted')
    expect(voteState(undefined)).toBe('not_voted')
  })

  it('is in progress for a row that is not submitted', () => {
    expect(voteState({ is_submitted: false, conflict_of_interest: false })).toBe('in_progress')
  })

  it('is voted once the row is submitted', () => {
    expect(voteState({ is_submitted: true, conflict_of_interest: false })).toBe('voted')
  })

  it('is recused whenever conflict of interest is set, even if submitted', () => {
    expect(voteState({ is_submitted: false, conflict_of_interest: true })).toBe('recused')
    expect(voteState({ is_submitted: true, conflict_of_interest: true })).toBe('recused')
  })
})

describe('voteState — Phase 2, with rated counts', () => {
  const submitted = { is_submitted: true, conflict_of_interest: false }
  const draft = { is_submitted: false, conflict_of_interest: false }

  it('is voted only when submitted and every applicable criterion is rated', () => {
    expect(voteState(submitted, { ratedCount: 5, criteriaCount: 5 })).toBe('voted')
    expect(voteState(submitted, { ratedCount: 6, criteriaCount: 5 })).toBe('voted')
  })

  it('is in progress when submitted but criteria were added since', () => {
    expect(voteState(submitted, { ratedCount: 3, criteriaCount: 5 })).toBe('in_progress')
  })

  it('does not trust the counts alone: all rated but not submitted is in progress', () => {
    expect(voteState(draft, { ratedCount: 5, criteriaCount: 5 })).toBe('in_progress')
  })

  it('is in progress with a row or at least one rating, not voted otherwise', () => {
    expect(voteState(draft, { ratedCount: 0, criteriaCount: 5 })).toBe('in_progress')
    expect(voteState(null, { ratedCount: 2, criteriaCount: 5 })).toBe('in_progress')
    expect(voteState(null, { ratedCount: 0, criteriaCount: 5 })).toBe('not_voted')
    expect(voteState(undefined, { ratedCount: 0, criteriaCount: 0 })).toBe('not_voted')
  })

  it('still lets recusal win over the counts', () => {
    expect(voteState({ is_submitted: true, conflict_of_interest: true }, { ratedCount: 5, criteriaCount: 5 })).toBe(
      'recused',
    )
  })
})

describe('isDone', () => {
  it.each<[VoteState, boolean]>([
    ['voted', true],
    ['recused', true],
    ['in_progress', false],
    ['not_voted', false],
  ])('%s → %s', (state, expected) => {
    expect(isDone(state)).toBe(expected)
  })
})

describe('findOnStage / findUpNext', () => {
  const queue = [
    project('done', 'Done', { order: 0, status: 'completed' }),
    project('skipped', 'Skipped', { order: 1, status: 'skipped' }),
    project('stage', 'Stage', { order: 2, status: 'presenting' }),
    project('deck', 'Deck', { order: 3, status: 'on_deck' }),
    project('later', 'Later', { order: 4, status: 'queued' }),
    project('no-slot', 'No slot'),
  ]

  it('finds the presenting project on stage and the on-deck one up next', () => {
    expect(findOnStage(queue)?.id).toBe('stage')
    expect(findUpNext(queue)?.id).toBe('deck')
  })

  it('treats Q&A as still on stage', () => {
    const qa = [project('qa', 'QA', { order: 0, status: 'qa' }), project('next', 'Next', { order: 1, status: 'on_deck' })]
    expect(findOnStage(qa)?.id).toBe('qa')
  })

  it('returns null when nobody is on stage or on deck', () => {
    const idle = [project('q', 'Queued', { order: 0, status: 'queued' }), project('n', 'No slot')]
    expect(findOnStage(idle)).toBeNull()
    expect(findUpNext(idle)).toBeNull()
    expect(findOnStage([])).toBeNull()
    expect(findUpNext([])).toBeNull()
  })

  it('does not confuse on stage with up next', () => {
    const deckOnly = [project('deck', 'Deck', { order: 0, status: 'on_deck' })]
    expect(findOnStage(deckOnly)).toBeNull()
    const stageOnly = [project('stage', 'Stage', { order: 0, status: 'presenting' })]
    expect(findUpNext(stageOnly)).toBeNull()
  })
})

describe('resolveQueueEntries — Phase 2 counts', () => {
  type Flags = Partial<{
    is_submitted: boolean; conflict_of_interest: boolean; total_score: number | null
    rated_count: number; weighted_average: number | null
  }>
  const score = (projectId: string, round: string, flags: Flags = {}) => ({
    id: `score-${projectId}-${round}`,
    project_id: projectId,
    round,
    total_score: flags.total_score ?? null,
    is_submitted: flags.is_submitted ?? false,
    conflict_of_interest: flags.conflict_of_interest ?? false,
    rated_count: flags.rated_count ?? 0,
    weighted_average: flags.weighted_average ?? null,
  })
  const queued = (id: string, title: string, criteriaCount = 5) => ({ ...project(id, title), criteria_count: criteriaCount })

  it('keeps the project order and matches preliminary scores by project id', () => {
    const projects = [queued('b', 'Beta'), queued('a', 'Alpha'), queued('c', 'Gamma')]
    const entries = resolveQueueEntries(projects, [
      score('a', 'preliminary', { is_submitted: true, total_score: 68, rated_count: 5, weighted_average: 6.8 }),
      score('c', 'preliminary', { conflict_of_interest: true, rated_count: 2 }),
    ])
    expect(entries.map((e) => e.project.id)).toEqual(['b', 'a', 'c'])
    expect(entries.map((e) => e.state)).toEqual(['not_voted', 'voted', 'recused'])
    expect(entries[1].score?.weighted_average).toBe(6.8)
    expect(entries[0].score).toBeNull()
  })

  it('reports rated / applicable counts for an in-progress vote', () => {
    const [entry] = resolveQueueEntries([queued('a', 'Alpha', 5)], [score('a', 'preliminary', { rated_count: 3 })])
    expect(entry.state).toBe('in_progress')
    expect(entry.ratedCount).toBe(3)
    expect(entry.criteriaCount).toBe(5)
  })

  it('does not show voted when a criterion was added after the vote', () => {
    const [entry] = resolveQueueEntries(
      [queued('a', 'Alpha', 6)],
      [score('a', 'preliminary', { is_submitted: true, rated_count: 5 })],
    )
    expect(entry.state).toBe('in_progress')
  })

  it('ignores score rows from another round', () => {
    const entries = resolveQueueEntries([queued('a', 'Alpha')], [score('a', 'final', { is_submitted: true, rated_count: 5 })])
    expect(entries[0].state).toBe('not_voted')
    expect(entries[0].score).toBeNull()
    expect(entries[0].ratedCount).toBe(0)
  })

  it('handles no projects and no scores', () => {
    expect(resolveQueueEntries([], [score('a', 'preliminary')])).toEqual([])
    expect(resolveQueueEntries([queued('a', 'Alpha')], []).map((e) => e.state)).toEqual(['not_voted'])
  })
})

describe('filterQueueEntries and queueProgress', () => {
  const states: VoteState[] = ['voted', 'in_progress', 'recused', 'not_voted', 'voted']
  const entries = states.map((state, i) => ({ id: String(i), state }))

  it('returns every entry when hide voted is off', () => {
    const shown = filterQueueEntries(entries, false)
    expect(shown).toEqual(entries)
    expect(shown).not.toBe(entries)
  })

  it('hides voted and recused entries when hide voted is on', () => {
    expect(filterQueueEntries(entries, true).map((e) => e.id)).toEqual(['1', '3'])
  })

  it('counts voted and recused as done out of all entries', () => {
    expect(queueProgress(entries)).toEqual({ done: 3, total: 5 })
    expect(queueProgress([])).toEqual({ done: 0, total: 0 })
  })
})

describe('formatVoteScore', () => {
  it('converts the 0–100 total to the 0–10 scale with one decimal', () => {
    expect(formatVoteScore(68)).toBe('6.8')
    expect(formatVoteScore(100)).toBe('10.0')
    expect(formatVoteScore(0)).toBe('0.0')
    expect(formatVoteScore(58.75)).toBe('5.9')
  })

  it('is null when there is no usable total', () => {
    expect(formatVoteScore(null)).toBeNull()
    expect(formatVoteScore(undefined)).toBeNull()
    expect(formatVoteScore(Number.NaN)).toBeNull()
  })
})

describe('formatWeightedAverage', () => {
  it('shows the 0–10 weighted average with one decimal', () => {
    expect(formatWeightedAverage(6.83)).toBe('6.8')
    expect(formatWeightedAverage(10)).toBe('10.0')
    expect(formatWeightedAverage(1)).toBe('1.0')
  })

  it('is null when there is no usable average', () => {
    expect(formatWeightedAverage(null)).toBeNull()
    expect(formatWeightedAverage(undefined)).toBeNull()
    expect(formatWeightedAverage(Number.NaN)).toBeNull()
  })
})
