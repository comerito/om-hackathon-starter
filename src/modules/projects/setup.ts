import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: [
      'projects.view', 'projects.create', 'projects.edit', 'projects.delete',
      'projects.manage', 'projects.flag',
    ],
    admin: [
      'projects.view', 'projects.create', 'projects.edit', 'projects.delete',
      'projects.manage', 'projects.flag',
    ],
  },
  defaultCustomerRoleFeatures: {
    participant: [
      'portal.projects.view', 'portal.projects.edit', 'portal.projects.submit',
    ],
    mentor: [
      'portal.projects.view',
    ],
    judge: [
      'portal.projects.view',
    ],
  },
}

export default setup
