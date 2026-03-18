import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['competitions.*'],
    admin: ['competitions.*'],
  },
  defaultCustomerRoleFeatures: {
    buyer: [
      'portal.competitions.view',
      'portal.competitions.checkin',
      'portal.participants.view',
    ],
    participant: [
      'portal.competitions.view',
      'portal.competitions.checkin',
      'portal.participants.view',
    ],
    mentor: [
      'portal.competitions.view',
      'portal.competitions.checkin',
      'portal.participants.view',
      'portal.mentoring.view',
      'portal.mentoring.tracks',
    ],
    judge: [
      'portal.competitions.view',
      'portal.competitions.checkin',
      'portal.participants.view',
    ],
  },
}
export default setup
