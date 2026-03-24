import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: [
      'competitions.view', 'competitions.create', 'competitions.edit', 'competitions.delete',
      'competitions.stages.manage', 'competitions.agenda.manage', 'competitions.announcements.manage',
      'competitions.participants.manage', 'competitions.checkin.manage',
    ],
    admin: [
      'competitions.view', 'competitions.create', 'competitions.edit', 'competitions.delete',
      'competitions.stages.manage', 'competitions.agenda.manage', 'competitions.announcements.manage',
      'competitions.participants.manage', 'competitions.checkin.manage',
    ],
  },
  defaultCustomerRoleFeatures: {
    participant: [
      'portal.competitions.view', 'portal.competitions.checkin',
    ],
    mentor: [
      'portal.competitions.view', 'portal.competitions.checkin',
    ],
    judge: [
      'portal.competitions.view', 'portal.competitions.checkin',
    ],
  },
}

export default setup
