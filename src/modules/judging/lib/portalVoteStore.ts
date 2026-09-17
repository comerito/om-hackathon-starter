import { LockMode } from '@mikro-orm/core'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { Generated, Kysely } from 'kysely'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import { ProjectScore } from '../data/entities'
import { Competition } from '../../competitions/data/entities'
import { STAR_SCALE, type ScoringRating } from './scoring'
import type { CriterionVoteWrite, VoteScoreRecord, VoteStore } from './portalVote'

/**
 * MikroORM 7 implementation of the vote-write port (`portalVote.ts`).
 *
 * - `atomic` is `withAtomicFlush(em, phases, { transaction: true })`: it calls `em.begin()` on
 *   this EntityManager, so `em.getKysely()` below returns the transaction-bound Kysely instance and
 *   the raw upserts share the transaction with the entity flushes.
 * - The `ProjectScore` row is loaded with `LockMode.PESSIMISTIC_WRITE` (`SELECT … FOR UPDATE`),
 *   which always queries (never the identity map) and merges the fresh row into the managed entity.
 * - Criterion rows are written and read only through Kysely, so no managed `CriterionScore`
 *   entity can hold a stale copy of a row another request just changed.
 */

/** Column shapes of the two tables written through Kysely (snake_case, see the cookbook §11). */
type VoteDb = {
  judging_project_score: {
    id: Generated<string>
    project_id: string
    judge_id: string
    judge_panel_id: string
    round: string
    competition_id: string
    conflict_of_interest: boolean
    is_submitted: boolean
    tenant_id: string
    organization_id: string
    created_at: Date
    updated_at: Date
  }
  judging_criterion_score: {
    id: Generated<string>
    project_score_id: string
    criterion_id: string
    score: number
    scale: number | null
    note: string | null
    tenant_id: string
    organization_id: string
    updated_at: Date
  }
}

export const PORTAL_VOTE_FLUSH_LABEL = 'judging.portal.score'

export function createPortalVoteStore(em: EntityManager): VoteStore {
  const db = (): Kysely<VoteDb> => em.getKysely<VoteDb>()

  return {
    async atomic(phases) {
      await withAtomicFlush(em, phases, { transaction: true, label: PORTAL_VOTE_FLUSH_LABEL })
    },

    async insertScoreShellIfMissing(shell) {
      await db()
        .insertInto('judging_project_score')
        .values({
          project_id: shell.projectId,
          judge_id: shell.judgeId,
          judge_panel_id: shell.judgePanelId,
          round: shell.round,
          competition_id: shell.competitionId,
          conflict_of_interest: false,
          is_submitted: false,
          tenant_id: shell.tenantId,
          organization_id: shell.organizationId,
          created_at: shell.now,
          updated_at: shell.now,
        })
        .onConflict((oc) => oc.columns(['project_id', 'judge_id', 'round']).doNothing())
        .execute()
    },

    async lockScore(key) {
      return em.findOne(ProjectScore, {
        projectId: key.projectId,
        judgeId: key.judgeId,
        round: key.round,
        tenantId: key.tenantId,
        organizationId: key.organizationId,
      } as FilterQuery<ProjectScore>, { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true })
    },

    async readCompetitionStage(competitionId, scope) {
      const competition = await em.findOne(Competition, {
        id: competitionId, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null,
      } as FilterQuery<Competition>, { refresh: true })
      return competition?.stage ?? null
    },

    async upsertCriterionScores(scoreId, writes, scope) {
      const base = (write: CriterionVoteWrite) => ({
        project_score_id: scoreId,
        criterion_id: write.criterionId,
        tenant_id: scope.tenantId,
        organization_id: scope.organizationId,
        updated_at: scope.now,
      })
      const conflictColumns = ['project_score_id', 'criterion_id'] as const

      // Stars and a note: the rating and the note both change.
      const ratedWithNote = writes.filter((w) => w.stars !== undefined && w.note !== undefined)
      if (ratedWithNote.length > 0) {
        await db()
          .insertInto('judging_criterion_score')
          .values(ratedWithNote.map((w) => ({ ...base(w), score: w.stars ?? 0, scale: STAR_SCALE, note: w.note ?? null })))
          .onConflict((oc) => oc.columns(conflictColumns).doUpdateSet((eb) => ({
            score: eb.ref('excluded.score'),
            scale: eb.ref('excluded.scale'),
            note: eb.ref('excluded.note'),
            updated_at: eb.ref('excluded.updated_at'),
          })))
          .execute()
      }

      // Stars only: an existing note is kept.
      const ratedOnly = writes.filter((w) => w.stars !== undefined && w.note === undefined)
      if (ratedOnly.length > 0) {
        await db()
          .insertInto('judging_criterion_score')
          .values(ratedOnly.map((w) => ({ ...base(w), score: w.stars ?? 0, scale: STAR_SCALE, note: null })))
          .onConflict((oc) => oc.columns(conflictColumns).doUpdateSet((eb) => ({
            score: eb.ref('excluded.score'),
            scale: eb.ref('excluded.scale'),
            updated_at: eb.ref('excluded.updated_at'),
          })))
          .execute()
      }

      // Note only: a missing row becomes an unrated placeholder (score 0 on the star scale);
      // an existing rating — star or legacy — is left alone.
      const noteOnly = writes.filter((w) => w.stars === undefined && w.note !== undefined)
      if (noteOnly.length > 0) {
        await db()
          .insertInto('judging_criterion_score')
          .values(noteOnly.map((w) => ({ ...base(w), score: 0, scale: STAR_SCALE, note: w.note ?? null })))
          .onConflict((oc) => oc.columns(conflictColumns).doUpdateSet((eb) => ({
            note: eb.ref('excluded.note'),
            updated_at: eb.ref('excluded.updated_at'),
          })))
          .execute()
      }
    },

    patchScore(record: VoteScoreRecord, patch) {
      Object.assign(record, patch)
    },

    async loadRatings(scoreId): Promise<ScoringRating[]> {
      const rows = await db()
        .selectFrom('judging_criterion_score')
        .select(['criterion_id', 'score', 'scale'])
        .where('project_score_id', '=', scoreId)
        .execute()
      return rows.map((row) => ({
        criterionId: row.criterion_id,
        score: Number(row.score),
        scale: row.scale === null ? null : Number(row.scale),
      }))
    },

    reset() {
      em.clear()
    },
  }
}
