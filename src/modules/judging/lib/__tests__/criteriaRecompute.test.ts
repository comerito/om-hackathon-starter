import {
  planScoreRecompute,
  recomputeScoresForCriterionChange,
  resolveCriterionChangeScope,
  type CriteriaRecomputeStore,
  type CriterionChangeScope,
  type RecomputeCriterion,
  type RecomputeRating,
  type RecomputeScope,
  type RecomputeScoreRecord,
  type ScoreRecomputePatch,
} from '../criteriaRecompute'

const TENANT = 'tenant-1'
const ORG = 'org-1'
const COMPETITION = 'competition-1'
const SCOPE: RecomputeScope = { tenantId: TENANT, organizationId: ORG }
const NOW = new Date('2026-09-17T12:00:00Z')
const FIRST_VOTED = new Date('2026-09-16T10:00:00Z')

type StoredCriterion = RecomputeCriterion & CriterionChangeScope & { deleted: boolean }

class MemoryRecomputeStore implements CriteriaRecomputeStore {
  stage: string | null = 'judging'
  criteria: StoredCriterion[] = []
  scores: RecomputeScoreRecord[] = []
  projectTracks = new Map<string, string | null>()
  ratings: RecomputeRating[] = []
  patches: Array<{ scoreId: string; patch: ScoreRecomputePatch }> = []
  calls: string[] = []

  addCriterion(criterion: Partial<StoredCriterion> & { id: string }): StoredCriterion {
    const stored: StoredCriterion = {
      round: 'both', trackId: null, order: this.criteria.length, weight: 1, maxScore: 10,
      competitionId: COMPETITION, tenantId: TENANT, organizationId: ORG, deleted: false,
      ...criterion,
    }
    this.criteria.push(stored)
    return stored
  }

  async findCriterionScope(criterionId: string, hint: Partial<RecomputeScope>) {
    this.calls.push('findCriterionScope')
    const found = this.criteria.find((c) => c.id === criterionId
      && (!hint.tenantId || c.tenantId === hint.tenantId)
      && (!hint.organizationId || c.organizationId === hint.organizationId))
    return found ? { competitionId: found.competitionId, tenantId: found.tenantId, organizationId: found.organizationId } : null
  }

  async atomic(phases: Array<() => Promise<void>>) {
    this.calls.push('atomic')
    for (const phase of phases) {
      await phase()
      this.calls.push('flush')
    }
  }

  async lockScores(competitionId: string, scope: RecomputeScope) {
    this.calls.push('lockScores')
    expect(scope).toEqual(SCOPE)
    expect(competitionId).toBe(COMPETITION)
    return this.scores
  }

  async readCompetitionStage() {
    this.calls.push('readCompetitionStage')
    return this.stage
  }

  async loadCriteria(competitionId: string, scope: RecomputeScope) {
    this.calls.push('loadCriteria')
    return this.criteria.filter((c) => !c.deleted && c.competitionId === competitionId
      && c.tenantId === scope.tenantId && c.organizationId === scope.organizationId)
  }

  async loadProjectTracks(projectIds: ReadonlyArray<string>) {
    this.calls.push('loadProjectTracks')
    expect(projectIds.length).toBeGreaterThan(0)
    return new Map([...this.projectTracks].filter(([id]) => projectIds.includes(id)))
  }

  async loadRatings(scoreIds: ReadonlyArray<string>) {
    this.calls.push('loadRatings')
    expect(scoreIds.length).toBeGreaterThan(0)
    return this.ratings.filter((r) => scoreIds.includes(r.projectScoreId))
  }

  patchScore(record: RecomputeScoreRecord, patch: ScoreRecomputePatch) {
    this.calls.push('patchScore')
    this.patches.push({ scoreId: record.id, patch })
    Object.assign(record, patch)
  }
}

function stars(scoreId: string, criterionId: string, value: number): RecomputeRating {
  return { projectScoreId: scoreId, criterionId, score: value, scale: 10 }
}

/** Two criteria (weights 0.6 / 0.4), one judge voted 8★ and 6★ → 72. */
function votedCompetition(): { store: MemoryRecomputeStore; score: RecomputeScoreRecord } {
  const store = new MemoryRecomputeStore()
  store.addCriterion({ id: 'c1', weight: 0.6 })
  store.addCriterion({ id: 'c2', weight: 0.4 })
  store.projectTracks.set('project-1', 'track-1')
  const score: RecomputeScoreRecord = {
    id: 'score-1', projectId: 'project-1', round: 'preliminary',
    conflictOfInterest: false, isSubmitted: true, submittedAt: FIRST_VOTED, totalScore: 72,
  }
  store.scores.push(score)
  store.ratings.push(stars('score-1', 'c1', 8), stars('score-1', 'c2', 6))
  return { store, score }
}

const payloadFor = (id: string) => ({ id, tenantId: TENANT, organizationId: ORG })
const run = (store: MemoryRecomputeStore, id: string) =>
  recomputeScoresForCriterionChange(store, payloadFor(id), { now: () => NOW })

describe('recomputeScoresForCriterionChange', () => {
  it('sends a voted score back to in progress when a criterion is added, total over the rated ones', async () => {
    const { store, score } = votedCompetition()
    store.addCriterion({ id: 'c3', weight: 0.5 })

    const outcome = await run(store, 'c3')

    expect(outcome).toEqual({ status: 'recomputed', competitionId: COMPETITION, scoreCount: 1, changedCount: 1 })
    expect(score.isSubmitted).toBe(false)
    expect(score.totalScore).toBe(72)
    expect(score.submittedAt).toEqual(FIRST_VOTED)
  })

  it('makes the score voted again when the unrated criterion is deleted, keeping submitted_at', async () => {
    const { store, score } = votedCompetition()
    const c3 = store.addCriterion({ id: 'c3', weight: 0.5 })
    await run(store, 'c3')
    expect(score.isSubmitted).toBe(false)

    c3.deleted = true
    const outcome = await run(store, 'c3')

    expect(outcome).toMatchObject({ status: 'recomputed', changedCount: 1 })
    expect(score.isSubmitted).toBe(true)
    expect(score.totalScore).toBe(72)
    expect(score.submittedAt).toEqual(FIRST_VOTED)
  })

  it('treats a note-only placeholder (0 on the star scale) as not rated', async () => {
    const { store, score } = votedCompetition()
    store.addCriterion({ id: 'c3', weight: 0.5 })
    store.ratings.push({ projectScoreId: 'score-1', criterionId: 'c3', score: 0, scale: 10 })

    await run(store, 'c3')

    expect(score.isSubmitted).toBe(false)
    expect(score.totalScore).toBe(72)
  })

  it('sets submitted_at on the first transition to voted', async () => {
    const { store, score } = votedCompetition()
    score.isSubmitted = false
    score.submittedAt = null
    score.totalScore = 80

    await run(store, 'c1')

    expect(score).toMatchObject({ isSubmitted: true, totalScore: 72, submittedAt: NOW })
  })

  it('updates the total when a weight changes', async () => {
    const { store, score } = votedCompetition()
    store.criteria[0].weight = 0.4
    store.criteria[1].weight = 0.6

    const outcome = await run(store, 'c1')

    expect(outcome).toMatchObject({ status: 'recomputed', changedCount: 1 })
    expect(score.totalScore).toBe(68)
    expect(score.isSubmitted).toBe(true)
  })

  it('writes nothing once results are published', async () => {
    const { store, score } = votedCompetition()
    store.addCriterion({ id: 'c3' })
    store.stage = 'finished'

    const outcome = await run(store, 'c3')

    expect(outcome).toEqual({ status: 'skipped', reason: 'results_published', competitionId: COMPETITION })
    expect(store.patches).toEqual([])
    expect(store.calls).not.toContain('loadRatings')
    expect(score).toMatchObject({ isSubmitted: true, totalScore: 72 })
  })

  it('keeps a recused score with a null total and not submitted', async () => {
    const { store, score } = votedCompetition()
    score.conflictOfInterest = true
    score.isSubmitted = false
    score.totalScore = null
    store.addCriterion({ id: 'c3' })

    const outcome = await run(store, 'c3')

    expect(outcome).toMatchObject({ status: 'recomputed', changedCount: 0 })
    expect(score).toMatchObject({ isSubmitted: false, totalScore: null, submittedAt: FIRST_VOTED })
  })

  it('does not crash on a competition without scores', async () => {
    const store = new MemoryRecomputeStore()
    store.addCriterion({ id: 'c1' })

    const outcome = await run(store, 'c1')

    expect(outcome).toEqual({ status: 'recomputed', competitionId: COMPETITION, scoreCount: 0, changedCount: 0 })
    expect(store.calls).toEqual(['findCriterionScope', 'atomic', 'lockScores', 'readCompetitionStage', 'flush', 'flush'])
  })

  it('reads in the first phase and mutates only in the second', async () => {
    const { store } = votedCompetition()
    store.addCriterion({ id: 'c3' })

    await run(store, 'c3')

    const firstFlush = store.calls.indexOf('flush')
    expect(store.calls.indexOf('patchScore')).toBeGreaterThan(firstFlush)
    expect(store.calls.slice(firstFlush + 1)).toEqual(['patchScore', 'flush'])
  })

  it('resolves criteria per round and track', async () => {
    const store = new MemoryRecomputeStore()
    store.addCriterion({ id: 'global', weight: 1 })
    store.addCriterion({ id: 'other-track', trackId: 'track-2', weight: 1 })
    store.addCriterion({ id: 'final-only', round: 'final', weight: 1 })
    store.projectTracks.set('project-1', 'track-1')
    const score: RecomputeScoreRecord = {
      id: 'score-1', projectId: 'project-1', round: 'preliminary',
      conflictOfInterest: false, isSubmitted: false, submittedAt: null, totalScore: null,
    }
    store.scores.push(score)
    store.ratings.push(stars('score-1', 'global', 9))

    await run(store, 'final-only')

    expect(score).toMatchObject({ isSubmitted: true, totalScore: 90, submittedAt: NOW })
  })

  it('skips when the competition is missing', async () => {
    const { store } = votedCompetition()
    store.stage = null

    const outcome = await run(store, 'c1')

    expect(outcome).toEqual({ status: 'skipped', reason: 'competition_not_found', competitionId: COMPETITION })
    expect(store.patches).toEqual([])
  })
})

describe('resolveCriterionChangeScope', () => {
  it('uses a complete payload without a lookup', async () => {
    const store = new MemoryRecomputeStore()
    const scope = await resolveCriterionChangeScope(store, { competitionId: COMPETITION, tenantId: TENANT, organizationId: ORG })
    expect(scope).toEqual({ competitionId: COMPETITION, tenantId: TENANT, organizationId: ORG })
    expect(store.calls).toEqual([])
  })

  it('loads the (soft-deleted) criterion when the payload has no competition id', async () => {
    const store = new MemoryRecomputeStore()
    store.addCriterion({ id: 'c1', deleted: true })
    await expect(resolveCriterionChangeScope(store, { id: 'c1' }))
      .resolves.toEqual({ competitionId: COMPETITION, tenantId: TENANT, organizationId: ORG })
  })

  it('does not resolve a criterion of another tenant', async () => {
    const store = new MemoryRecomputeStore()
    store.addCriterion({ id: 'c1' })
    await expect(resolveCriterionChangeScope(store, { id: 'c1', tenantId: 'tenant-2', organizationId: ORG })).resolves.toBeNull()
  })

  it('skips without a criterion id or an unknown criterion', async () => {
    const store = new MemoryRecomputeStore()
    await expect(recomputeScoresForCriterionChange(store, {})).resolves
      .toEqual({ status: 'skipped', reason: 'missing_scope', competitionId: null })
    await expect(recomputeScoresForCriterionChange(store, payloadFor('missing'))).resolves
      .toEqual({ status: 'skipped', reason: 'missing_scope', competitionId: null })
    expect(store.calls).not.toContain('atomic')
  })
})

describe('planScoreRecompute', () => {
  it('returns no patch for an already consistent score and ignores scores of unknown projects', () => {
    const { store } = votedCompetition()
    store.scores.push({
      id: 'orphan', projectId: 'gone', round: 'preliminary',
      conflictOfInterest: false, isSubmitted: true, submittedAt: FIRST_VOTED, totalScore: 50,
    })
    const planned = planScoreRecompute({
      criteria: store.criteria, scores: store.scores, projectTracks: store.projectTracks, ratings: store.ratings, now: NOW,
    })
    expect(planned).toEqual([])
  })
})
