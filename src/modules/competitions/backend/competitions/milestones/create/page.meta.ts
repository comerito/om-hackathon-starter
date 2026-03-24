export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.milestones.manage'],
  pageTitle: 'New Milestone',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  breadcrumb: [
    { label: 'Milestones', labelKey: 'competitions.milestones.pageTitle', href: '/backend/competitions/milestones' },
    { label: 'New' },
  ],
}
