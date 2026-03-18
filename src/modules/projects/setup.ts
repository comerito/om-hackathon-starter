import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['projects.*'],
    admin: ['projects.*'],
  },
  defaultCustomerRoleFeatures: {
    buyer: ['portal.projects.view', 'portal.projects.edit', 'portal.projects.submit'],
    participant: ['portal.projects.view', 'portal.projects.edit', 'portal.projects.submit'],
    mentor: ['portal.projects.view'],
    judge: ['portal.projects.view'],
  },
}
export default setup
