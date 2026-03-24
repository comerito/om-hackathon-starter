import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { ProjectScore, CriterionScore, JudgingCriterion } from '../data/entities'
import { saveScoreSchema } from '../data/validators'

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

    // Find or create ProjectScore
    let projectScore = await em.findOne(ProjectScore, {
      projectId: parsed.project_id,
      judgeId,
      round: parsed.round,
    } as FilterQuery<ProjectScore>)

    const now = new Date()
    if (!projectScore) {
      projectScore = em.create(ProjectScore, {
        projectId: parsed.project_id,
        judgeId,
        judgePanelId: parsed.judge_panel_id,
        round: parsed.round,
        competitionId: parsed.competition_id,
        comment: parsed.comment ?? null,
        privateNotes: parsed.private_notes ?? null,
        conflictOfInterest: parsed.conflict_of_interest,
        isSubmitted: parsed.is_submitted,
        submittedAt: parsed.is_submitted ? now : null,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        createdAt: now,
        updatedAt: now,
      })
      await em.persistAndFlush(projectScore)
    } else {
      projectScore.comment = parsed.comment ?? projectScore.comment
      projectScore.privateNotes = parsed.private_notes ?? projectScore.privateNotes
      projectScore.conflictOfInterest = parsed.conflict_of_interest
      if (parsed.is_submitted && !projectScore.isSubmitted) {
        projectScore.isSubmitted = true
        projectScore.submittedAt = now
      }
      projectScore.updatedAt = now
    }

    // Upsert criterion scores
    for (const cs of parsed.criterion_scores) {
      let criterionScore = await em.findOne(CriterionScore, {
        projectScoreId: projectScore.id,
        criterionId: cs.criterion_id,
      } as FilterQuery<CriterionScore>)

      if (!criterionScore) {
        criterionScore = em.create(CriterionScore, {
          projectScoreId: projectScore.id,
          criterionId: cs.criterion_id,
          score: cs.score,
          note: cs.note ?? null,
          tenantId: scope.tenantId,
          organizationId: scope.organizationId,
          updatedAt: now,
        })
        em.persist(criterionScore)
      } else {
        criterionScore.score = cs.score
        criterionScore.note = cs.note ?? criterionScore.note
        criterionScore.updatedAt = now
      }
    }

    // Compute totalScore (weighted sum)
    if (parsed.criterion_scores.length > 0) {
      const criteria = await em.find(JudgingCriterion, {
        competitionId: parsed.competition_id,
        deletedAt: null,
      } as FilterQuery<JudgingCriterion>)

      const criteriaMap = new Map(criteria.map(c => [c.id, c]))
      let totalScore = 0
      for (const cs of parsed.criterion_scores) {
        const criterion = criteriaMap.get(cs.criterion_id)
        if (criterion) {
          // Normalize: (score / maxScore) * weight * 100
          totalScore += (cs.score / criterion.maxScore) * criterion.weight * 100
        }
      }
      projectScore.totalScore = Math.round(totalScore * 100) / 100
    }

    await em.persistAndFlush(projectScore)

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
