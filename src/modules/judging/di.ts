import type { AwilixContainer } from 'awilix'
import { asValue } from 'awilix'
import { ScoringService } from './lib/ScoringService'
import { DemoTimerService } from './lib/DemoTimerService'

export function register(container: AwilixContainer) {
  container.register({
    scoringService: {
      resolve: (c: { em: import('@mikro-orm/postgresql').EntityManager }) => new ScoringService(c.em),
      lifetime: 'SCOPED' as const,
    } as unknown as ReturnType<typeof asValue>,
    demoTimerService: {
      resolve: (c: { em: import('@mikro-orm/postgresql').EntityManager }) => new DemoTimerService(c.em),
      lifetime: 'SCOPED' as const,
    } as unknown as ReturnType<typeof asValue>,
  })
}
