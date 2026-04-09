import { createQueue } from '@open-mercato/queue'

export const metadata = {
  event: 'bounties.pull_request.detected',
  persistent: true,
  id: 'bounties-classify-on-detect',
}

export default async function handler(
  payload: { pullRequestId: string; tenantId: string; organizationId: string; competitionId: string },
) {
  const queue = createQueue('bounties-queue', 'local')

  await queue.enqueue({
    workerId: 'classify-pr',
    pullRequestId: payload.pullRequestId,
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
  })
}
