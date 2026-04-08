import type { AppContainer } from '@open-mercato/shared/lib/di/container'
import { asClass } from 'awilix'
import { createQueue, type Queue } from '@open-mercato/queue'
import { ClassificationService } from './services/ClassificationService'
import { GitHubService } from './services/GitHubService'
import { LeaderboardService } from './services/LeaderboardService'
import pollGithubHandler from './workers/poll-github'
import classifyPrHandler from './workers/classify-pr'

// Use globalThis to survive Next.js HMR — module-level `let` resets on re-evaluation
const QUEUE_KEY = Symbol.for('bounties-queue-instance')

export function register(container: AppContainer): void {
  container.register({
    bountyGitHubService: asClass(GitHubService).scoped(),
    bountyClassificationService: asClass(ClassificationService).scoped(),
    bountyLeaderboardService: asClass(LeaderboardService).scoped(),
  })

  // Start the local queue processor for bounties-queue once
  const g = globalThis as typeof globalThis & { [QUEUE_KEY]?: Queue }
  if (!g[QUEUE_KEY] && typeof process !== 'undefined' && process.env.QUEUE_STRATEGY !== 'async') {
    // Close any stale instance left by a previous HMR cycle (defensive)
    const prev = g[QUEUE_KEY]
    if (prev) prev.close().catch(() => {})

    const queue = createQueue('bounties-queue', 'local')
    g[QUEUE_KEY] = queue
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
