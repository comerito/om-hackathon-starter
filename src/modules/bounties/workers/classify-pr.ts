import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { BountyPullRequest, BountyPRStatus, BountyActivityType, BountyActivityLog } from '../data/entities'
import { ClassificationService } from '../services/ClassificationService'
import { SplitDetectionService } from '../services/SplitDetectionService'

export const metadata = {
  queue: 'bounties-queue',
  id: 'classify-pr',
  concurrency: 5,
}

interface ClassifyJobData {
  pullRequestId: string
  tenantId: string
  organizationId: string
}

const LOG_PREFIX = '[bounties:classify-pr]'

export default async function handler(
  job: { data: ClassifyJobData },
  ctx: { resolve: <T = any>(name: string) => T }
) {
  const em = ctx.resolve<EntityManager>('em')
  const eventBus = ctx.resolve<{ emit: (id: string, payload: Record<string, unknown>) => Promise<void> }>('eventBus')

  const pr = await em.findOne(BountyPullRequest, {
    id: job.data.pullRequestId,
    tenantId: job.data.tenantId,
  } as FilterQuery<BountyPullRequest>)

  if (!pr) return

  // Idempotency: skip if already classified or beyond
  if (pr.status !== BountyPRStatus.DETECTED) return

  // Step 1: Classify and check duplicates
  const classificationService = new ClassificationService()
  await classificationService.classifyAndDetectDuplicates(em, pr)

  // Log classification activity
  const activityType = pr.isDuplicate ? BountyActivityType.PR_DUPLICATE : BountyActivityType.PR_CLASSIFIED
  const message = pr.isDuplicate
    ? `PR #${pr.githubPrNumber} marked as duplicate (similarity: ${((pr.duplicateSimilarity ?? 0) * 100).toFixed(0)}%)`
    : `PR #${pr.githubPrNumber} classified: ${pr.classifications?.map(c => c.category).join(', ')} (confidence: ${((pr.classificationConfidence ?? 0) * 100).toFixed(0)}%)`

  const activity = em.create(BountyActivityLog, {
    tenantId: pr.tenantId,
    organizationId: pr.organizationId,
    type: activityType,
    pullRequestId: pr.id,
    message,
    metadata: { classifications: pr.classifications, confidence: pr.classificationConfidence },
    createdAt: new Date(),
  })
  em.persist(activity)
  await em.flush()

  // Step 2: Split detection (only for non-duplicate PRs)
  if (!pr.isDuplicate) {
    try {
      const splitService = new SplitDetectionService()
      const cluster = await splitService.checkForSplitting(em, pr)

      if (cluster) {
        console.log(LOG_PREFIX, `PR #${pr.githubPrNumber}: heuristic flagged split cluster (${cluster.reason})`)

        const analysis = await splitService.analyzeSplitCluster(em, cluster)

        if (analysis.isSplit && analysis.confidence >= 0.6) {
          const groupId = await splitService.applySplitGrouping(em, cluster, analysis)
          console.log(LOG_PREFIX, `PR #${pr.githubPrNumber}: split confirmed, groupId=${groupId}`)

          await eventBus.emit('bounties.pull_request.split_detected', {
            pullRequestId: pr.id,
            tenantId: pr.tenantId,
            organizationId: pr.organizationId,
            splitGroupId: groupId,
          })
        } else {
          console.log(LOG_PREFIX, `PR #${pr.githubPrNumber}: LLM says not a split (confidence=${analysis.confidence})`)
        }
      }
    } catch (err) {
      console.error(LOG_PREFIX, `Split detection failed for PR #${pr.githubPrNumber}:`, err)
      // Non-blocking: split detection failure shouldn't prevent classification
    }
  }

  const eventId = pr.isDuplicate
    ? 'bounties.pull_request.duplicate_detected'
    : 'bounties.pull_request.classified'

  await eventBus.emit(eventId, {
    pullRequestId: pr.id,
    tenantId: pr.tenantId,
    organizationId: pr.organizationId,
    status: pr.status,
    totalPoints: pr.totalPoints,
  })
}
