import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['bounties.view', 'bounties.judge', 'bounties.admin'],
    admin: ['bounties.view', 'bounties.judge', 'bounties.admin'],
  },
  defaultCustomerRoleFeatures: {
    participant: ['portal.bounties.view', 'portal.bounties.register_github'],
    judge: ['portal.bounties.view', 'portal.bounties.judge'],
  },
}

export default setup
