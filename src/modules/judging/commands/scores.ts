import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { ProjectScore, CriterionScore, JudgingCriterion } from '../data/entities'
import { saveScoreSchema } from '../data/validators'
import { Project } from '../../projects/data/entities'
import { computeScore, isLegacySubmitted, resolveApplicableCriteria } from '../lib/scoring'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'

function ensureScope(ctx: CommandRuntimeContext) {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })
  return { tenantId, organizationId }
}

// ── Save/Submit Score ───────────────────────────────────────────

const saveScoreCommand: CommandHandler<Record<string, unknown>, ProjectScore> = {
  id: 'judging.scores.save',
  async execute(rawInput, ctx) {
    const parsed = saveScoreSchema.parse(rawInput)
    const judgeId = ctx.auth?.sub ?? ctx.auth?.userId ?? null
    if (!judgeId) throw new CrudHttpError(401, { error: 'Authentication required' })

    const scope = ensureScope(ctx)
    const em = ctx.container.resolve('em') as EntityManager
    const now = new Date()

    // Every read happens before the first mutation: MikroORM 7 silently drops a pending UPDATE
    // when a find runs between a scalar change and its flush (AGENTS.md rule 3).
    const existingScore = await em.findOne(ProjectScore, {
      projectId: parsed.project_id,
      judgeId,
      round: parsed.round,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    } as FilterQuery<ProjectScore>)
    const project = await em.findOne(Project, {
      id: parsed.project_id, tenantId: scope.tenantId, organizationId: scope.organizationId,
    } as FilterQuery<Project>)
    const criteria = await em.find(JudgingCriterion, {
      competitionId: parsed.competition_id,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    } as FilterQuery<JudgingCriterion>)
    const applicable = resolveApplicableCriteria(criteria, { round: parsed.round, trackId: project?.trackId ?? null })
    const existingRows = existingScore
      ? await em.find(CriterionScore, { projectScoreId: existingScore.id } as FilterQuery<CriterionScore>)
      : []
    const existingRowMap = new Map(existingRows.map(row => [row.criterionId, row]))

    const holder: { score: ProjectScore | null } = { score: existingScore }
    await withAtomicFlush(em, [
      // Phase 1 — create the score row so its generated id is known.
      async () => {
        if (holder.score) return
        const created = em.create(ProjectScore, {
          projectId: parsed.project_id,
          judgeId,
          judgePanelId: parsed.judge_panel_id,
          round: parsed.round,
          competitionId: parsed.competition_id,
          comment: parsed.comment ?? null,
          privateNotes: parsed.private_notes ?? null,
          conflictOfInterest: parsed.conflict_of_interest,
          isSubmitted: false,
          submittedAt: null,
          tenantId: scope.tenantId,
          organizationId: scope.organizationId,
          createdAt: now,
          updatedAt: now,
        })
        em.persist(created)
        holder.score = created
      },
      // Phase 2 — scalars, criterion rows and the total, with no read in between.
      async () => {
        const projectScore = holder.score
        if (!projectScore) throw new CrudHttpError(500, { error: 'Score row was not created' })
        const legacySubmitted = parsed.is_submitted || isLegacySubmitted(projectScore)
        if (existingScore) {
          projectScore.comment = parsed.comment ?? projectScore.comment
          projectScore.privateNotes = parsed.private_notes ?? projectScore.privateNotes
          projectScore.conflictOfInterest = parsed.conflict_of_interest
        }
        if (parsed.is_submitted && !projectScore.isSubmitted) {
          projectScore.isSubmitted = true
          projectScore.submittedAt = now
        }
        projectScore.updatedAt = now

        // This command takes points on `0…max_score`, i.e. legacy-scale rows (`scale` null).
        for (const cs of parsed.criterion_scores) {
          const criterionScore = existingRowMap.get(cs.criterion_id)
          if (!criterionScore) {
            const created = em.create(CriterionScore, {
              projectScoreId: projectScore.id,
              criterionId: cs.criterion_id,
              score: cs.score,
              scale: null,
              note: cs.note ?? null,
              tenantId: scope.tenantId,
              organizationId: scope.organizationId,
              updatedAt: now,
            })
            em.persist(created)
            existingRowMap.set(cs.criterion_id, created)
          } else {
            criterionScore.score = cs.score
            criterionScore.scale = null
            criterionScore.note = cs.note ?? criterionScore.note
            criterionScore.updatedAt = now
          }
        }

        // Same formula as the judge portal (`computeScore`), over every row of the score.
        const summary = computeScore(
          applicable,
          [...existingRowMap.values()].map(row => ({ criterionId: row.criterionId, score: row.score, scale: row.scale ?? null })),
          { legacySubmitted },
        )
        projectScore.totalScore = summary.totalScore100
      },
    ], { transaction: true, label: 'judging.scores.save' })

    const projectScore = holder.score
    if (!projectScore) throw new CrudHttpError(500, { error: 'Score row was not created' })

    // Emit event
    if (parsed.is_submitted) {
      try {
        const eventBus = ctx.container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
        await eventBus.emit('judging.score.submitted', {
          projectScoreId: projectScore.id,
          projectId: parsed.project_id,
          judgeId,
          round: parsed.round,
          totalScore: projectScore.totalScore,
          competitionId: parsed.competition_id,
          tenantId: scope.tenantId,
          organizationId: scope.organizationId,
        })
      } catch (e) {
        console.error('[judging:scores.save] Event emit error:', e)
      }
    }

    return projectScore
  },
}

registerCommand(saveScoreCommand)
