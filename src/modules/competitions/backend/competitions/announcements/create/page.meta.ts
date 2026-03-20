export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.announcements.manage'],
  pageTitle: 'New Announcement',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  breadcrumb: [
    { label: 'Announcements', labelKey: 'competitions.announcements.pageTitle', href: '/backend/competitions/announcements' },
    { label: 'New' },
  ],
}
