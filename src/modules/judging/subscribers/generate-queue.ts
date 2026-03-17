/**
 * Generate demo queue subscriber.
 *
 * When projects are auto-published (batch event on stage advance to DEMOS),
 * this subscriber generates the demo presentation queue.
 */

export const metadata = {
  event: 'projects.batch.auto_published',
  sync: false,
  priority: 300,
  id: 'judging:generate-queue-on-publish',
}

interface BatchPublishedPayload {
  competitionId: string
  projectIds: string[]
  count: number
  tenantId: string
  organizationId: string
}

export default async function handler(
  payload: BatchPublishedPayload,
): Promise<void> {
  try {
    const { createRequestContainer } = await import('@open-mercato/shared/lib/di/container')
    const container = await createRequestContainer()
    const em = container.resolve('em') as import('@mikro-orm/postgresql').EntityManager

    const { DemoTimerService } = await import('../lib/DemoTimerService')
    const demoTimerService = new DemoTimerService(em)

    const result = await demoTimerService.generateQueue(
      payload.competitionId,
      'PRELIMINARY',
      payload.tenantId,
      payload.organizationId,
    )

    console.info('[judging] Generated demo queue on auto-publish', {
      competitionId: payload.competitionId,
      sessionsCreated: result.created,
    })

    // Emit queue updated event
    try {
      const eventBus = container.resolve('eventBus') as {
        emit?: (event: string, payload: unknown) => Promise<void>
        emitEvent?: (event: string, payload: unknown) => Promise<void>
      }
      const eventPayload = {
        competitionId: payload.competitionId,
        round: 'PRELIMINARY',
        created: result.created,
        tenantId: payload.tenantId,
        organizationId: payload.organizationId,
      }
      if (typeof eventBus.emit === 'function') {
        await eventBus.emit('judging.demo.queue_updated', eventPayload)
      } else if (typeof eventBus.emitEvent === 'function') {
        await eventBus.emitEvent('judging.demo.queue_updated', eventPayload)
      }
    } catch {
      // non-critical
    }
  } catch (err) {
    console.warn('[judging] Failed to generate demo queue', {
      competitionId: payload.competitionId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
