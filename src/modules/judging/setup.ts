import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: [
      'judging.view', 'judging.manage', 'judging.panels.manage', 'judging.criteria.manage',
      'judging.scores.view', 'judging.scores.manage', 'judging.demos.manage',
      'judging.finalists.manage', 'judging.results.view', 'judging.results.manage',
    ],
    admin: [
      'judging.view', 'judging.manage', 'judging.panels.manage', 'judging.criteria.manage',
      'judging.scores.view', 'judging.scores.manage', 'judging.demos.manage',
      'judging.finalists.manage', 'judging.results.view', 'judging.results.manage',
    ],
  },
  defaultCustomerRoleFeatures: {
    participant: [
      'portal.judging.demos.view', 'portal.judging.results.view',
    ],
    mentor: [
      'portal.judging.demos.view', 'portal.judging.results.view',
    ],
    // `portal.judging.results.export` is granted to `judge` only, and deliberately NOT to
    // `participant` or `mentor`: they may view the published ranking, they may not download the
    // full CSV of every project's scores (issue #118). Organisers reach the export through the
    // portal-admin `['*']` grant.
    judge: [
      'portal.judging.score', 'portal.judging.view_assigned',
      'portal.judging.demos.view', 'portal.judging.results.view',
      'portal.judging.results.export',
    ],
  },
}

export default setup
