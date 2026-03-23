import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['incidents.view', 'incidents.manage', 'incidents.resolve'],
    admin: ['incidents.view', 'incidents.manage', 'incidents.resolve'],
  },
  defaultCustomerRoleFeatures: {
    participant: ['portal.incidents.report'],
    mentor: ['portal.incidents.report'],
    judge: ['portal.incidents.report'],
  },
}

export default setup
