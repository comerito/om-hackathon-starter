import type { DemoStatus } from '../data/entities'

/**
 * Voting-queue helpers for the judge portal list (SPEC-007).
 *
 * The list is a queue in presentation order so the judge can follow the room: the team on stage
 * is highlighted, the next one tagged, and each project carries a vote badge. These helpers keep
 * the ordering and the badge rules asserted in one place instead of re-derived inline per page.
 */

export type VoteState = 'voted' | 'in_progress' | 'not_voted' | 'recused'

/** The demo slot a queue item needs; `null` when the project has no slot in the round. */
export type QueueDemo = { order: number; status: DemoStatus }

export type QueueItem = { title: string; demo: QueueDemo | null }

/** The judge's own stored score flags for a project; absent when no score row exists. */
export type VoteScoreSummary = { is_submitted: boolean; conflict_of_interest: boolean }

/**
 * Projects in presentation order: by demo slot order ascending, then projects without a slot,
 * alphabetically by title. Ties in slot order fall back to the title so the order is stable
 * across refetches. Returns a new array.
 */
export function sortByDemoOrder<T extends QueueItem>(projects: ReadonlyArray<T>): T[] {
  return [...projects].sort((a, b) => {
    if (a.demo && b.demo) {
      if (a.demo.order !== b.demo.order) return a.demo.order - b.demo.order
      return a.title.localeCompare(b.title)
    }
    if (a.demo) return -1
    if (b.demo) return 1
    return a.title.localeCompare(b.title)
  })
}

/**
 * Vote badge for one project.
 *
 * Phase 1 (no `counts`): derived only from the stored flags — recused wins, submitted is voted,
 * any other row is in progress, no row is not voted. Counting rated criteria would lie here,
 * because the old scoring page stores `0` for criteria the judge never clicked.
 *
 * Phase 2 (`counts` given): voted still requires the server's `is_submitted` and additionally
 * every applicable criterion rated; a row or at least one rating is in progress.
 */
export function voteState(
  score: VoteScoreSummary | null | undefined,
  counts?: { ratedCount: number; criteriaCount: number },
): VoteState {
  if (score?.conflict_of_interest) return 'recused'
  if (!counts) {
    if (score?.is_submitted) return 'voted'
    return score ? 'in_progress' : 'not_voted'
  }
  if (score?.is_submitted && counts.ratedCount >= counts.criteriaCount) return 'voted'
  if (counts.ratedCount > 0 || score) return 'in_progress'
  return 'not_voted'
}

/** Whether a project counts towards progress and is hidden by "Hide voted". */
export function isDone(state: VoteState): boolean {
  return state === 'voted' || state === 'recused'
}

const ON_STAGE_STATUSES: ReadonlySet<DemoStatus> = new Set<DemoStatus>(['presenting', 'qa'])

/** The project currently presenting or in Q&A, or `null` when nobody is on stage. */
export function findOnStage<T extends QueueItem>(projects: ReadonlyArray<T>): T | null {
  return projects.find((project) => project.demo !== null && ON_STAGE_STATUSES.has(project.demo.status)) ?? null
}

/** The project on deck, or `null` when no slot is marked as next. */
export function findUpNext<T extends QueueItem>(projects: ReadonlyArray<T>): T | null {
  return projects.find((project) => project.demo?.status === 'on_deck') ?? null
}
