import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['teams.*'],
    admin: ['teams.*'],
  },
  defaultCustomerRoleFeatures: {
    participant: [
      'portal.teams.view',
      'portal.teams.create',
      'portal.teams.join',
      'portal.teams.invite',
      'portal.teams.leave',
    ],
    mentor: ['portal.teams.view'],
    judge: ['portal.teams.view'],
  },
}
