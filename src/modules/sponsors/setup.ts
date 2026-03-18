import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['sponsors.*'],
    admin: ['sponsors.*'],
  },
  defaultCustomerRoleFeatures: {
    participant: ['portal.sponsors.view', 'portal.voting.cast', 'portal.voting.view'],
    mentor: ['portal.sponsors.view', 'portal.voting.view'],
    judge: ['portal.sponsors.view', 'portal.voting.view'],
  },
}
export default setup
