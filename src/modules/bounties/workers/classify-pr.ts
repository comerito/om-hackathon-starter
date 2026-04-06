import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { BountyPullRequest, BountyPRStatus, BountyActivityType, BountyActivityLog } from '../data/entities'
import { ClassificationService } from '../services/ClassificationService'

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

  const classificationService = new ClassificationService()
  await classificationService.classifyAndDetectDuplicates(em, pr)

  // Log activity
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
