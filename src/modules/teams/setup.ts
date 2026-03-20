import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: [
      'teams.view', 'teams.create', 'teams.edit', 'teams.delete',
      'teams.manage', 'teams.disqualify',
    ],
    admin: [
      'teams.view', 'teams.create', 'teams.edit', 'teams.delete',
      'teams.manage', 'teams.disqualify',
    ],
  },
  defaultCustomerRoleFeatures: {
    participant: [
      'portal.teams.view', 'portal.teams.create', 'portal.teams.edit',
      'portal.teams.invite', 'portal.teams.leave',
    ],
    mentor: [
      'portal.teams.view',
    ],
    judge: [
      'portal.teams.view',
    ],
  },
}

export default setup
