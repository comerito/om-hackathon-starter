import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['incidents.*'],
    admin: ['incidents.*'],
  },
  defaultCustomerRoleFeatures: {
    buyer: ['portal.incidents.report'],
    participant: ['portal.incidents.report'],
    mentor: ['portal.incidents.report'],
    judge: ['portal.incidents.report'],
  },
}
export default setup
