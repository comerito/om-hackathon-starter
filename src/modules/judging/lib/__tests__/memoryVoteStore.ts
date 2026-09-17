import type { ScoringRating } from '../scoring'
import type { CriterionVoteWrite, VoteScoreKey, VoteScorePatch, VoteScoreRecord, VoteStore } from '../portalVote'

/**
 * In-memory `VoteStore` for tests (not a test file itself — `testMatch` only picks `*.test.ts`).
 *
 * It models the two properties the real store gets from Postgres: `atomic` is all-or-nothing
 * (a throw restores the snapshot taken when the transaction began) and serialised per store
 * (the `FOR UPDATE` row lock), so two concurrent saves cannot interleave their phases.
 */

export type MemoryScore = VoteScoreRecord & VoteScoreKey & { competitionId: string; judgePanelId: string }
export type MemoryRow = { criterionId: string; score: number; scale: number | null; note: string | null }

export type MemoryVoteStoreOptions = {
  /** Stage seen by `readCompetitionStage` (i.e. under the row lock). */
  stage?: string | null
  /** Throw a Postgres unique violation from the first N shell inserts. */
  uniqueViolations?: number
}

function keyOf(key: VoteScoreKey): string {
  return [key.tenantId, key.organizationId, key.projectId, key.judgeId, key.round].join('|')
}

export class MemoryVoteStore implements VoteStore {
  scores = new Map<string, MemoryScore>()
  rows = new Map<string, Map<string, MemoryRow>>()
  stage: string | null
  uniqueViolations: number
  /** Method names in call order, for asserting what the route reached. */
  calls: string[] = []
  /** Every shell insert attempt, including those that hit an existing row. */
  shells: Array<VoteScoreKey & { competitionId: string; judgePanelId: string }> = []
  commits = 0
  rollbacks = 0
  resets = 0
  private nextId = 1
  private lock: Promise<void> = Promise.resolve()

  constructor(options: MemoryVoteStoreOptions = {}) {
    this.stage = options.stage === undefined ? 'judging' : options.stage
    this.uniqueViolations = options.uniqueViolations ?? 0
  }

  /** Seeds an existing score row (and its criterion rows) as if saved by an earlier request. */
  seed(score: Partial<MemoryScore> & VoteScoreKey, rows: MemoryRow[] = []): MemoryScore {
    const record: MemoryScore = {
      id: score.id ?? `score-${this.nextId++}`,
      competitionId: score.competitionId ?? 'competition',
      judgePanelId: score.judgePanelId ?? 'panel',
      comment: null,
      privateNotes: null,
      conflictOfInterest: false,
      isSubmitted: false,
      submittedAt: null,
      totalScore: null,
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      ...score,
    }
    this.scores.set(keyOf(record), record)
    this.rows.set(record.id, new Map(rows.map((row) => [row.criterionId, { ...row }])))
    return record
  }

  onlyScore(): MemoryScore | undefined {
    return [...this.scores.values()][0]
  }

  rowsOf(scoreId: string): MemoryRow[] {
    return [...(this.rows.get(scoreId)?.values() ?? [])]
  }

  async atomic(phases: Array<() => Promise<void>>): Promise<void> {
    const previous = this.lock
    let release: () => void = () => undefined
    this.lock = new Promise<void>((resolve) => { release = resolve })
    await previous
    this.calls.push('atomic')
    const snapshotScores = new Map([...this.scores].map(([k, v]) => [k, { ...v }]))
    const snapshotRows = new Map([...this.rows].map(([k, v]) => [k, new Map([...v].map(([ck, cv]) => [ck, { ...cv }]))]))
    try {
      for (const phase of phases) {
        await phase()
        // Yield between phases so a concurrent caller would interleave here without the lock.
        await Promise.resolve()
      }
      this.commits += 1
    } catch (error) {
      this.rollbacks += 1
      this.scores = snapshotScores
      this.rows = snapshotRows
      throw error
    } finally {
      release()
    }
  }

  async insertScoreShellIfMissing(shell: VoteScoreKey & { competitionId: string; judgePanelId: string; now: Date }): Promise<void> {
    this.calls.push('insertScoreShellIfMissing')
    const { now, ...rest } = shell
    this.shells.push(rest)
    if (this.uniqueViolations > 0) {
      this.uniqueViolations -= 1
      throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' })
    }
    if (this.scores.has(keyOf(shell))) return
    this.seed({ ...rest, updatedAt: now })
  }

  async lockScore(key: VoteScoreKey): Promise<VoteScoreRecord | null> {
    this.calls.push('lockScore')
    return this.scores.get(keyOf(key)) ?? null
  }

  async readCompetitionStage(): Promise<string | null> {
    this.calls.push('readCompetitionStage')
    return this.stage
  }

  async upsertCriterionScores(scoreId: string, writes: ReadonlyArray<CriterionVoteWrite>): Promise<void> {
    this.calls.push('upsertCriterionScores')
    const rows = this.rows.get(scoreId) ?? new Map<string, MemoryRow>()
    for (const write of writes) {
      const existing = rows.get(write.criterionId)
      if (!existing) {
        rows.set(write.criterionId, {
          criterionId: write.criterionId,
          score: write.stars ?? 0,
          scale: 10,
          note: write.note ?? null,
        })
        continue
      }
      if (write.stars !== undefined) {
        existing.score = write.stars
        existing.scale = 10
      }
      if (write.note !== undefined) existing.note = write.note
    }
    this.rows.set(scoreId, rows)
  }

  patchScore(record: VoteScoreRecord, patch: VoteScorePatch): void {
    this.calls.push('patchScore')
    // Patch the row currently in the map (a rollback may have replaced the object).
    const current = [...this.scores.values()].find((score) => score.id === record.id)
    Object.assign(record, patch)
    if (current && current !== record) Object.assign(current, patch)
  }

  async loadRatings(scoreId: string): Promise<ScoringRating[]> {
    this.calls.push('loadRatings')
    return this.rowsOf(scoreId).map((row) => ({ criterionId: row.criterionId, score: row.score, scale: row.scale }))
  }

  reset(): void {
    this.calls.push('reset')
    this.resets += 1
  }
}
