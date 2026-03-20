import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: [
      'tracks.view', 'tracks.create', 'tracks.edit', 'tracks.delete',
    ],
    admin: [
      'tracks.view', 'tracks.create', 'tracks.edit', 'tracks.delete',
    ],
  },
  defaultCustomerRoleFeatures: {
    participant: [
      'portal.tracks.view',
    ],
    mentor: [
      'portal.tracks.view',
    ],
    judge: [
      'portal.tracks.view',
    ],
  },
}

export default setup
