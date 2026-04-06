import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { ScheduledJob } from '@open-mercato/scheduler/modules/scheduler/data/entities'

const POLL_JOB_NAME = 'Bounty Hunting — GitHub PR Poll'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['bounties.view', 'bounties.judge', 'bounties.admin'],
    admin: ['bounties.view', 'bounties.judge', 'bounties.admin'],
  },
  defaultCustomerRoleFeatures: {
    participant: ['portal.bounties.view', 'portal.bounties.register_github'],
    judge: ['portal.bounties.view'],
  },

  async seedDefaults({ em, tenantId, organizationId }) {
    // Create the GitHub polling scheduled job if it doesn't exist
    const existing = await em.findOne(ScheduledJob, {
      name: POLL_JOB_NAME,
      tenantId,
      deletedAt: null,
    } as FilterQuery<ScheduledJob>)

    if (!existing) {
      const job = em.create(ScheduledJob, {
        name: POLL_JOB_NAME,
        description: 'Polls GitHub API every minute for new PRs with the bounty-hunting label. Enable this when the bounty hunting track is active.',
        scopeType: 'organization',
        tenantId,
        organizationId,
        scheduleType: 'cron',
        scheduleValue: '*/1 * * * *',
        timezone: 'UTC',
        targetType: 'queue',
        targetQueue: 'bounties-queue',
        targetPayload: {
          workerId: 'poll-github',
          data: { tenantId, organizationId },
        },
        isEnabled: false,
        sourceType: 'module',
        sourceModule: 'bounties',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      em.persist(job)
      await em.flush()
    }
  },
}

export default setup
