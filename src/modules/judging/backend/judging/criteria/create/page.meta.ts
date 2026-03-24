export const metadata = {
  requireAuth: true,
  requireFeatures: ['judging.criteria.manage'],
  pageTitle: 'Create Criterion',
  pageTitleKey: 'judging.criteria.create.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  breadcrumb: [
    { label: 'Demos & Judging', labelKey: 'judging.list.title', href: '/backend/judging' },
    { label: 'Create Criterion', labelKey: 'judging.criteria.create.title' },
  ],
}
