/**
 * Auto-suggest People's Choice prize subscriber.
 *
 * When the competition advances to FINISHED stage, this subscriber
 * automatically assigns the People's Choice prize to the project
 * with the most peer votes.
 */

export const metadata = {
  event: 'competitions.competition.stage_advanced',
  sync: false,
  priority: 600,
  id: 'sponsors:auto-suggest-prize',
}

interface StageAdvancedPayload {
  competitionId: string
  oldStage: string
  newStage: string
  tenantId: string
  organizationId: string
}

export default async function handler(
  payload: StageAdvancedPayload,
): Promise<void> {
  if (payload.newStage !== 'FINISHED') return

  try {
    const { createRequestContainer } = await import('@open-mercato/shared/lib/di/container')
    const container = await createRequestContainer()
    const em = container.resolve('em') as import('@mikro-orm/postgresql').EntityManager
    const knex = em.getKnex()

    const { VotingService } = await import('../lib/VotingService')
    const votingService = new VotingService(em)
    const tally = await votingService.getVoteTally(payload.competitionId)

    if (tally.length === 0) {
      console.info('[sponsors] No votes cast, skipping People\'s Choice assignment', {
        competitionId: payload.competitionId,
      })
      return
    }

    const topProject = tally[0]

    // Find People's Choice prize for this competition
    const peoplePrize = await knex('sponsors_prize')
      .where({
        competition_id: payload.competitionId,
        category: 'PEOPLES_CHOICE',
      })
      .whereNull('winning_project_id')
      .first()

    if (!peoplePrize) {
      console.info('[sponsors] No unassigned People\'s Choice prize found', {
        competitionId: payload.competitionId,
      })
      return
    }

    // Assign the prize to the top-voted project
    await knex('sponsors_prize')
      .where('id', peoplePrize.id)
      .update({
        winning_project_id: topProject.projectId,
        winning_team_id: topProject.teamId,
        awarded_at: new Date(),
        updated_at: new Date(),
      })

    console.info('[sponsors] Auto-assigned People\'s Choice prize', {
      competitionId: payload.competitionId,
      prizeId: peoplePrize.id,
      projectId: topProject.projectId,
      voteCount: topProject.voteCount,
    })

    // Emit prize awarded event
    try {
      const eventBus = container.resolve('eventBus') as {
        emit?: (event: string, payload: unknown) => Promise<void>
        emitEvent?: (event: string, payload: unknown) => Promise<void>
      }
      const eventPayload = {
        prizeId: peoplePrize.id,
        projectId: topProject.projectId,
        teamId: topProject.teamId,
        category: 'PEOPLES_CHOICE',
        tenantId: payload.tenantId,
        organizationId: payload.organizationId,
      }
      if (typeof eventBus.emit === 'function') {
        await eventBus.emit('sponsors.prize.awarded', eventPayload)
      } else if (typeof eventBus.emitEvent === 'function') {
        await eventBus.emitEvent('sponsors.prize.awarded', eventPayload)
      }
    } catch {
      // non-critical
    }
  } catch (err) {
    console.warn('[sponsors] Failed to auto-assign People\'s Choice prize', {
      competitionId: payload.competitionId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
