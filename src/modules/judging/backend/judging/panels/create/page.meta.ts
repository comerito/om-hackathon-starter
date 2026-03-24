export const metadata = {
  requireAuth: true,
  requireFeatures: ['judging.panels.manage'],
  pageTitle: 'Create Panel',
  pageTitleKey: 'judging.panels.create.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  breadcrumb: [
    { label: 'Demos & Judging', labelKey: 'judging.list.title', href: '/backend/judging' },
    { label: 'Create Panel', labelKey: 'judging.panels.create.title' },
  ],
}
