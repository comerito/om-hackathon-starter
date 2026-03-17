/**
 * Calculate final scores subscriber.
 *
 * When the competition advances to FINISHED stage, this subscriber
 * persists final score snapshots on all scored projects.
 */

export const metadata = {
  event: 'competitions.competition.stage_advanced',
  sync: false,
  priority: 500,
  id: 'judging:calculate-final-scores',
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

    const { ScoringService } = await import('../lib/ScoringService')
    const scoringService = new ScoringService(em)

    const updated = await scoringService.persistFinalScores(payload.competitionId)

    console.info('[judging] Persisted final scores on competition finish', {
      competitionId: payload.competitionId,
      projectsScored: updated,
    })

    // Emit results published event
    try {
      const eventBus = container.resolve('eventBus') as {
        emit?: (event: string, payload: unknown) => Promise<void>
        emitEvent?: (event: string, payload: unknown) => Promise<void>
      }
      const eventPayload = {
        competitionId: payload.competitionId,
        projectsScored: updated,
        tenantId: payload.tenantId,
        organizationId: payload.organizationId,
      }
      if (typeof eventBus.emit === 'function') {
        await eventBus.emit('judging.results.published', eventPayload)
      } else if (typeof eventBus.emitEvent === 'function') {
        await eventBus.emitEvent('judging.results.published', eventPayload)
      }
    } catch {
      // non-critical
    }
  } catch (err) {
    console.warn('[judging] Failed to calculate final scores', {
      competitionId: payload.competitionId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
