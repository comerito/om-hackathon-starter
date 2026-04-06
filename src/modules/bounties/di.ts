import type { AppContainer } from '@open-mercato/shared/lib/di/container'
import { asClass } from 'awilix'
import { createQueue } from '@open-mercato/queue'
import { ClassificationService } from './services/ClassificationService'
import { GitHubService } from './services/GitHubService'
import { LeaderboardService } from './services/LeaderboardService'
import pollGithubHandler from './workers/poll-github'
import classifyPrHandler from './workers/classify-pr'

let queueStarted = false

export function register(container: AppContainer): void {
  container.register({
    bountyGitHubService: asClass(GitHubService).scoped(),
    bountyClassificationService: asClass(ClassificationService).scoped(),
    bountyLeaderboardService: asClass(LeaderboardService).scoped(),
  })

  // Start the local queue processor for bounties-queue once
  if (!queueStarted && typeof process !== 'undefined' && process.env.QUEUE_STRATEGY !== 'async') {
    queueStarted = true

    const queue = createQueue('bounties-queue', 'local')
    queue.process(async (job, ctx) => {
      const payload = (job as { payload?: Record<string, unknown> }).payload ?? job
      const workerId = (payload as Record<string, unknown>).payload
        ? ((payload as Record<string, unknown>).payload as Record<string, unknown>).workerId
        : (payload as Record<string, unknown>).workerId

      console.log(`[bounties-queue] Processing job. workerId=${workerId}`)

      // Build a context with DI resolution
      const { createRequestContainer } = await import('@open-mercato/shared/lib/di/container')
      const reqContainer = await createRequestContainer()
      const workerCtx = {
        resolve: <T = unknown>(name: string) => reqContainer.resolve(name) as T,
      }

      // Route to the correct worker
      const jobData = {
        data: {
          ...(payload as Record<string, unknown>),
          ...((payload as Record<string, unknown>).payload as Record<string, unknown> ?? {}),
        },
      }

      if (workerId === 'poll-github') {
        await pollGithubHandler(jobData as any, workerCtx)
      } else if (workerId === 'classify-pr') {
        await classifyPrHandler(jobData as any, workerCtx)
      } else {
        console.warn(`[bounties-queue] Unknown workerId: ${workerId}`)
      }
    }).catch(err => {
      console.error('[bounties-queue] Failed to start queue processor:', err)
    })

    console.log('[bounties:di] Started bounties-queue local processor')
  }
}
