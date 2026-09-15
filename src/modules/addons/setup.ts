import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['addons.view', 'addons.send'],
    admin: ['addons.view', 'addons.send'],
  },
}

export default setup
