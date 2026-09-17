import { LockMode } from '@mikro-orm/core'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { Kysely } from 'kysely'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import { JudgingCriterion, ProjectScore } from '../data/entities'
import { Competition } from '../../competitions/data/entities'
import { Project } from '../../projects/data/entities'
import {
  recomputeScoresForCriterionChange,
  type CriteriaRecomputeStore,
  type CriterionChangePayload,
  type RecomputeRating,
  type RecomputeScoreRecord,
} from './criteriaRecompute'

/**
 * MikroORM 7 implementation of `CriteriaRecomputeStore`, plus the handler shared by the
 * `judging.criterion.{created,updated,deleted}` subscribers (one event per subscriber file).
 */

type RatingDb = {
  judging_criterion_score: {
    project_score_id: string
    criterion_id: string
    score: number
    scale: number | null
    tenant_id: string
    organization_id: string
  }
}

export const CRITERIA_RECOMPUTE_FLUSH_LABEL = 'judging.criteria.recompute_scores'

export function createCriteriaRecomputeStore(em: EntityManager): CriteriaRecomputeStore {
  const db = (): Kysely<RatingDb> => em.getKysely<RatingDb>()

  return {
    async findCriterionScope(criterionId, hint) {
      // No `deletedAt` condition: a `.deleted` event is emitted after the soft delete.
      const where: Record<string, unknown> = { id: criterionId }
      if (hint.tenantId) where.tenantId = hint.tenantId
      if (hint.organizationId) where.organizationId = hint.organizationId
      const criterion = await em.findOne(JudgingCriterion, where as FilterQuery<JudgingCriterion>)
      if (!criterion) return null
      return {
        competitionId: criterion.competitionId,
        tenantId: criterion.tenantId,
        organizationId: criterion.organizationId,
      }
    },

    async atomic(phases) {
      await withAtomicFlush(em, phases, { transaction: true, label: CRITERIA_RECOMPUTE_FLUSH_LABEL })
    },

    async lockScores(competitionId, scope): Promise<RecomputeScoreRecord[]> {
      return em.find(ProjectScore, {
        competitionId, tenantId: scope.tenantId, organizationId: scope.organizationId,
      } as FilterQuery<ProjectScore>, { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true })
    },

    async readCompetitionStage(competitionId, scope) {
      const competition = await em.findOne(Competition, {
        id: competitionId, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null,
      } as FilterQuery<Competition>, { refresh: true })
      return competition?.stage ?? null
    },

    async loadCriteria(competitionId, scope) {
      return em.find(JudgingCriterion, {
        competitionId, tenantId: scope.tenantId, organizationId: scope.organizationId, deletedAt: null,
      } as FilterQuery<JudgingCriterion>, { refresh: true })
    },

    async loadProjectTracks(projectIds, scope) {
      if (projectIds.length === 0) return new Map()
      const projects = await em.find(Project, {
        id: { $in: [...projectIds] }, tenantId: scope.tenantId, organizationId: scope.organizationId,
      } as FilterQuery<Project>)
      return new Map(projects.map((project) => [project.id, project.trackId ?? null]))
    },

    async loadRatings(scoreIds, scope): Promise<RecomputeRating[]> {
      if (scoreIds.length === 0) return []
      const rows = await db()
        .selectFrom('judging_criterion_score')
        .select(['project_score_id', 'criterion_id', 'score', 'scale'])
        .where('project_score_id', 'in', [...scoreIds])
        .where('tenant_id', '=', scope.tenantId)
        .where('organization_id', '=', scope.organizationId)
        .execute()
      return rows.map((row) => ({
        projectScoreId: row.project_score_id,
        criterionId: row.criterion_id,
        score: Number(row.score),
        scale: row.scale === null ? null : Number(row.scale),
      }))
    },

    patchScore(record, patch) {
      Object.assign(record, patch)
    },
  }
}

export type SubscriberContext = { resolve: <T = unknown>(name: string) => T }

/** Subscriber body for every `judging.criterion.*` change event. */
export async function handleCriterionChangeEvent(
  eventId: string,
  subscriberId: string,
  payload: CriterionChangePayload,
  ctx: SubscriberContext,
): Promise<void> {
  // A fork: the recompute must not flush (or read stale copies from) the emitter's identity map.
  const em = ctx.resolve<EntityManager>('em').fork()
  const outcome = await recomputeScoresForCriterionChange(createCriteriaRecomputeStore(em), payload)
  if (outcome.status === 'skipped') {
    const log = outcome.reason === 'missing_scope' ? console.warn : console.info
    log(`[${subscriberId}] ${eventId}: recompute skipped (${outcome.reason})`, {
      criterionId: typeof payload.id === 'string' ? payload.id : null,
      competitionId: outcome.competitionId,
    })
    return
  }
  console.info(
    `[${subscriberId}] ${eventId}: recomputed ${outcome.changedCount}/${outcome.scoreCount} scores in competition ${outcome.competitionId}`,
  )
}
