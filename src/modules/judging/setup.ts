import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['judging.*'],
    admin: ['judging.*'],
  },
  defaultCustomerRoleFeatures: {
    buyer: ['portal.judging.demos.view', 'portal.judging.results.view'],
    participant: ['portal.judging.demos.view', 'portal.judging.results.view'],
    mentor: ['portal.judging.demos.view', 'portal.judging.results.view'],
    judge: ['portal.judging.score', 'portal.judging.view_assigned', 'portal.judging.demos.view', 'portal.judging.results.view'],
  },
}
export default setup
