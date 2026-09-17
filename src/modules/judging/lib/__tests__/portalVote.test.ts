import { VotingClosedError, isUniqueViolation, mergeCriterionWrites, saveJudgeVote, type SaveJudgeVoteInput } from '../portalVote'
import { MemoryVoteStore } from './memoryVoteStore'

/**
 * SPEC-007 step 7: the per-click vote write. The route tests cover the HTTP contract; these pin
 * the transaction shape against the in-memory store — phase order, rollback, retry, locking.
 */

const KEY = { projectId: 'p1', judgeId: 'j1', round: 'preliminary', tenantId: 't1', organizationId: 'o1' }
const CRITERIA = [
  { id: 'c1', weight: 0.5, maxScore: 10 },
  { id: 'c2', weight: 0.5, maxScore: 5 },
]
const NOW = new Date('2026-09-17T10:00:00Z')

function input(overrides: Partial<SaveJudgeVoteInput> = {}): SaveJudgeVoteInput {
  return {
    key: KEY,
    competitionId: 'comp',
    judgePanelId: 'panel',
    applicable: CRITERIA,
    now: () => NOW,
    ...overrides,
  }
}

describe('saveJudgeVote — transaction shape', () => {
  it('inserts the shell, locks it and re-reads the stage before writing anything', async () => {
    const store = new MemoryVoteStore()
    await saveJudgeVote(store, input({ criterionScores: [{ criterionId: 'c1', stars: 7 }] }))
    expect(store.calls).toEqual([
      'atomic',
      'insertScoreShellIfMissing', 'lockScore', 'readCompetitionStage',
      'upsertCriterionScores', 'patchScore',
      'loadRatings', 'patchScore',
    ])
    expect(store.commits).toBe(1)
  })

  it('rolls everything back, shell included, when the stage under the lock is published', async () => {
    const store = new MemoryVoteStore({ stage: 'finished' })
    await expect(saveJudgeVote(store, input({ criterionScores: [{ criterionId: 'c1', stars: 7 }] })))
      .rejects.toBeInstanceOf(VotingClosedError)
    expect(store.rollbacks).toBe(1)
    expect(store.scores.size).toBe(0)
    expect(store.calls).not.toContain('upsertCriterionScores')
  })

  it('does not write the upsert phase when no criterion is sent', async () => {
    const store = new MemoryVoteStore()
    const result = await saveJudgeVote(store, input({ comment: 'Nice demo' }))
    expect(store.calls).not.toContain('upsertCriterionScores')
    expect(store.onlyScore()?.comment).toBe('Nice demo')
    expect(result.summary.ratedCount).toBe(0)
    expect(result.transition).toBeNull()
  })

  it('retries the whole write once on a unique violation', async () => {
    const store = new MemoryVoteStore({ uniqueViolations: 1 })
    const result = await saveJudgeVote(store, input({ criterionScores: [{ criterionId: 'c1', stars: 7 }] }))
    expect(store.resets).toBe(1)
    expect(store.rollbacks).toBe(1)
    expect(store.commits).toBe(1)
    expect(result.summary.ratedCount).toBe(1)
  })

  it('gives up after the second unique violation', async () => {
    const store = new MemoryVoteStore({ uniqueViolations: 2 })
    await expect(saveJudgeVote(store, input({ criterionScores: [{ criterionId: 'c1', stars: 7 }] })))
      .rejects.toMatchObject({ code: '23505' })
    expect(store.resets).toBe(1)
  })

  it('does not retry other errors', async () => {
    const store = new MemoryVoteStore()
    store.loadRatings = async () => { throw new Error('boom') }
    await expect(saveJudgeVote(store, input())).rejects.toThrow('boom')
    expect(store.resets).toBe(0)
  })

  it('serialises two simultaneous first saves so the recompute sees both ratings', async () => {
    const store = new MemoryVoteStore()
    const [first, second] = await Promise.all([
      saveJudgeVote(store, input({ criterionScores: [{ criterionId: 'c1', stars: 8 }] })),
      saveJudgeVote(store, input({ criterionScores: [{ criterionId: 'c2', stars: 6 }] })),
    ])
    expect(store.scores.size).toBe(1)
    expect(first.scoreId).toBe(second.scoreId)
    expect(first.transition).toBeNull()
    expect(second.transition).toBe('judging.score.submitted')
    const score = store.onlyScore()!
    expect(score.isSubmitted).toBe(true)
    expect(score.totalScore).toBe(70)
  })
})

describe('mergeCriterionWrites', () => {
  it('collapses repeated criteria, later fields winning and omitted fields kept', () => {
    expect(mergeCriterionWrites([
      { criterionId: 'c1', stars: 3 },
      { criterionId: 'c2', note: 'x' },
      { criterionId: 'c1', note: 'late note' },
      { criterionId: 'c1', stars: 9 },
    ])).toEqual([
      { criterionId: 'c1', stars: 9, note: 'late note' },
      { criterionId: 'c2', note: 'x' },
    ])
  })

  it('drops items that change nothing', () => {
    expect(mergeCriterionWrites([{ criterionId: 'c1' }])).toEqual([])
  })
})

describe('isUniqueViolation', () => {
  it('recognises the Postgres code on raw and wrapped errors only', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true)
    expect(isUniqueViolation(Object.assign(new Error('x'), { code: '23505' }))).toBe(true)
    expect(isUniqueViolation({ code: '23503' })).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
    expect(isUniqueViolation('23505')).toBe(false)
  })
})
