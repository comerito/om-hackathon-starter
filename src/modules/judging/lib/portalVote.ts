import { areResultsPublished } from './resultsScope'
import { computeScore, isLegacySubmitted, type ScoreSummary, type ScoringCriterion, type ScoringRating } from './scoring'

/**
 * The judge's per-click vote write (SPEC-007 → `POST /api/judging/portal/score-project`).
 *
 * The orchestration is written against a small `VoteStore` port so the transaction shape — shell
 * insert, row lock, stage re-check, upserts, recompute from persisted rows — is unit-testable
 * without a database. `portalVoteStore.ts` is the MikroORM 7 implementation.
 */

/** Unique key of a `judging_project_score` row, plus the tenant scope every query carries. */
export type VoteScoreKey = {
  projectId: string
  judgeId: string
  round: string
  tenantId: string
  organizationId: string
}

/** The scalar fields of a `ProjectScore` the vote write reads and writes. */
export type VoteScoreRecord = {
  id: string
  comment?: string | null
  privateNotes?: string | null
  conflictOfInterest: boolean
  isSubmitted: boolean
  submittedAt?: Date | null
  totalScore?: number | null
  updatedAt: Date
}

export type VoteScorePatch = Partial<Omit<VoteScoreRecord, 'id'>>

/** One criterion rating to write. `stars` omitted = keep the rating; `note` omitted = keep the note. */
export type CriterionVoteWrite = {
  criterionId: string
  stars?: number
  note?: string | null
}

export type VoteStore = {
  /**
   * Runs the phases inside ONE transaction, flushing managed-entity changes after each phase
   * (`withAtomicFlush`). A throw rolls everything back.
   */
  atomic(phases: Array<() => Promise<void>>): Promise<void>
  /** `INSERT … ON CONFLICT (project_id, judge_id, round) DO NOTHING`. */
  insertScoreShellIfMissing(shell: VoteScoreKey & { competitionId: string; judgePanelId: string; now: Date }): Promise<void>
  /** Loads the row with `SELECT … FOR UPDATE`, bypassing any cached copy. */
  lockScore(key: VoteScoreKey): Promise<VoteScoreRecord | null>
  /** Current stage of the competition, read inside the transaction; `null` when not found. */
  readCompetitionStage(competitionId: string, scope: { tenantId: string; organizationId: string }): Promise<string | null>
  /**
   * Upserts criterion rows on `(project_score_id, criterion_id)`. A row with `stars` writes
   * `score = stars, scale = 10`; a note-only write on a missing row inserts an unrated
   * placeholder (`score = 0, scale = 10`) and never touches an existing rating.
   */
  upsertCriterionScores(
    scoreId: string,
    writes: ReadonlyArray<CriterionVoteWrite>,
    scope: { tenantId: string; organizationId: string; now: Date },
  ): Promise<void>
  /** Applies the patch to the managed record; persisted by the phase flush. */
  patchScore(record: VoteScoreRecord, patch: VoteScorePatch): void
  /** Every persisted criterion row of the score (read after the upsert phase flushed). */
  loadRatings(scoreId: string): Promise<ScoringRating[]>
  /** Drops cached state before a retry. */
  reset(): void
}

export type SaveJudgeVoteInput = {
  key: VoteScoreKey
  competitionId: string
  judgePanelId: string
  /** Applicable criteria of the project (`resolveApplicableCriteria`). */
  applicable: ReadonlyArray<ScoringCriterion>
  criterionScores?: ReadonlyArray<CriterionVoteWrite>
  comment?: string | null
  privateNotes?: string | null
  conflictOfInterest?: boolean
  now?: () => Date
}

export type VoteFlags = { voted: boolean; recused: boolean }

export type SaveJudgeVoteResult = {
  scoreId: string
  before: VoteFlags
  after: VoteFlags
  summary: ScoreSummary
  totalScore: number | null
  /** The event to emit after commit, or `null` when the save changed no vote state. */
  transition: 'judging.score.submitted' | 'judging.score.updated' | null
}

/** Stage re-read under the row lock says results are published: nothing was written. */
export class VotingClosedError extends Error {
  constructor() {
    super('Voting is closed')
    this.name = 'VotingClosedError'
  }
}

/** A Postgres unique violation, raw (`pg`) or wrapped by MikroORM (both carry `code`). */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505'
}

/** Collapses repeated criterion ids into one write each; later fields win, omitted fields keep earlier ones. */
export function mergeCriterionWrites(writes: ReadonlyArray<CriterionVoteWrite>): CriterionVoteWrite[] {
  const merged = new Map<string, CriterionVoteWrite>()
  for (const write of writes) {
    const current = merged.get(write.criterionId) ?? { criterionId: write.criterionId }
    const next: CriterionVoteWrite = { ...current }
    if (write.stars !== undefined) next.stars = write.stars
    if (write.note !== undefined) next.note = write.note
    merged.set(write.criterionId, next)
  }
  return [...merged.values()].filter((write) => write.stars !== undefined || write.note !== undefined)
}

function flagsOf(record: Pick<VoteScoreRecord, 'isSubmitted' | 'conflictOfInterest'>): VoteFlags {
  const recused = record.conflictOfInterest
  return { recused, voted: record.isSubmitted && !recused }
}

function transitionOf(before: VoteFlags, after: VoteFlags): SaveJudgeVoteResult['transition'] {
  if (!before.voted && after.voted) return 'judging.score.submitted'
  if (before.voted && !after.voted) return 'judging.score.updated'
  if (before.recused !== after.recused) return 'judging.score.updated'
  return null
}

async function attemptSave(store: VoteStore, input: SaveJudgeVoteInput): Promise<SaveJudgeVoteResult> {
  const now = (input.now ?? (() => new Date()))()
  const { key } = input
  const scope = { tenantId: key.tenantId, organizationId: key.organizationId }
  const writes = mergeCriterionWrites(input.criterionScores ?? [])

  const state: {
    record: VoteScoreRecord | null
    before: VoteFlags
    legacySubmitted: boolean
    summary: ScoreSummary | null
  } = { record: null, before: { voted: false, recused: false }, legacySubmitted: false, summary: null }

  const lockedRecord = (): VoteScoreRecord => {
    if (!state.record) throw new Error('Score row is not locked')
    return state.record
  }

  await store.atomic([
    // Phase 1 — make sure the row exists, lock it, and re-check the stage under the lock so a
    // save cannot commit once final scores are being calculated.
    async () => {
      await store.insertScoreShellIfMissing({ ...key, competitionId: input.competitionId, judgePanelId: input.judgePanelId, now })
      const record = await store.lockScore(key)
      if (!record) throw new Error('Score row missing after insert')
      const stage = await store.readCompetitionStage(input.competitionId, scope)
      if (areResultsPublished(stage)) throw new VotingClosedError()
      state.record = record
      state.before = flagsOf(record)
      state.legacySubmitted = isLegacySubmitted(record)
    },
    // Phase 2 — criterion upserts and the scalars the judge actually sent. No read follows the
    // scalar patch inside this phase; `atomic` flushes it before phase 3 reads.
    async () => {
      const record = lockedRecord()
      if (writes.length > 0) await store.upsertCriterionScores(record.id, writes, { ...scope, now })
      const patch: VoteScorePatch = { updatedAt: now }
      if (input.comment !== undefined) patch.comment = input.comment
      if (input.privateNotes !== undefined) patch.privateNotes = input.privateNotes
      if (input.conflictOfInterest !== undefined) patch.conflictOfInterest = input.conflictOfInterest
      store.patchScore(record, patch)
    },
    // Phase 3 — recompute from ALL persisted rows (the lock serialises writers, so this is complete).
    async () => {
      const record = lockedRecord()
      const ratings = await store.loadRatings(record.id)
      const summary = computeScore(input.applicable, ratings, { legacySubmitted: state.legacySubmitted })
      state.summary = summary
      if (record.conflictOfInterest) {
        store.patchScore(record, { isSubmitted: false, totalScore: null })
        return
      }
      store.patchScore(record, {
        isSubmitted: summary.isComplete,
        totalScore: summary.totalScore100,
        // "First time voted": kept when the vote later drops back to in progress.
        submittedAt: record.submittedAt ?? (summary.isComplete ? now : null),
      })
    },
  ])

  const record = lockedRecord()
  if (!state.summary) throw new Error('Vote summary was not computed')
  const after = flagsOf(record)
  return {
    scoreId: record.id,
    before: state.before,
    after,
    summary: state.summary,
    totalScore: record.totalScore ?? null,
    transition: transitionOf(state.before, after),
  }
}

/**
 * Saves one partial vote. Retries the whole transaction once when a unique violation still
 * escapes (two first saves racing on a constraint the `ON CONFLICT` clauses did not cover).
 * Throws `VotingClosedError` when the stage re-read under the lock is published.
 */
export async function saveJudgeVote(store: VoteStore, input: SaveJudgeVoteInput): Promise<SaveJudgeVoteResult> {
  try {
    return await attemptSave(store, input)
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    store.reset()
    return attemptSave(store, input)
  }
}
