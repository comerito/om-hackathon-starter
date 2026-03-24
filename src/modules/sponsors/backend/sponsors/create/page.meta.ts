export const metadata = {
  requireAuth: true,
  requireFeatures: ['sponsors.create'],
  pageTitle: 'Add Sponsor',
  pageTitleKey: 'sponsors.create.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  breadcrumb: [
    { label: 'Sponsors & Prizes', labelKey: 'sponsors.list.title', href: '/backend/sponsors' },
    { label: 'Add Sponsor', labelKey: 'sponsors.create.title' },
  ],
}
