export const metadata = {
  requireAuth: true,
  requireFeatures: ['sponsors.prizes.manage'],
  pageTitle: 'Add Prize',
  pageTitleKey: 'sponsors.prizes.create.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  breadcrumb: [
    { label: 'Sponsors & Prizes', labelKey: 'sponsors.list.title', href: '/backend/sponsors' },
    { label: 'Add Prize', labelKey: 'sponsors.prizes.create.title' },
  ],
}
