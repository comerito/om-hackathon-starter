import type { AwilixContainer } from 'awilix'
import { asClass } from 'awilix'
import { StageService } from './lib/StageService'

export function register(container: AwilixContainer) {
  container.register({
    stageService: asClass(StageService).singleton(),
  })
}
