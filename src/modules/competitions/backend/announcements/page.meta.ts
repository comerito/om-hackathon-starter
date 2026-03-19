export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.announcements.manage'],
  pageTitle: 'Announcements',
  pageTitleKey: 'competitions.announcements.pageTitle',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 115,
  breadcrumb: [
    { label: 'HackOn', href: '/backend/competitions' },
    { label: 'Announcements', labelKey: 'competitions.announcements.pageTitle' },
  ],
}
