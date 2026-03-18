import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['tracks.*'],
    admin: ['tracks.*'],
  },
  defaultCustomerRoleFeatures: {
    participant: ['portal.tracks.view'],
    mentor: ['portal.tracks.view'],
    judge: ['portal.tracks.view'],
  },
}
export default setup
