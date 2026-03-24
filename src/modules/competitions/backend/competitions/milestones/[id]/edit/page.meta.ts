export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.milestones.manage'],
  pageTitle: 'Edit Milestone',
  pageTitleKey: 'competitions.milestones.edit.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  breadcrumb: [
    { label: 'Milestones', labelKey: 'competitions.milestones.pageTitle', href: '/backend/competitions/milestones' },
    { label: 'Edit', labelKey: 'competitions.milestones.edit.title' },
  ],
}
