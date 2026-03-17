import type { AwilixContainer } from 'awilix'
import { asValue } from 'awilix'
import { VotingService } from './lib/VotingService'

export function register(container: AwilixContainer) {
  container.register({
    votingService: {
      resolve: (c: { em: import('@mikro-orm/postgresql').EntityManager }) => new VotingService(c.em),
      lifetime: 'SCOPED' as const,
    } as unknown as ReturnType<typeof asValue>,
  })
}
