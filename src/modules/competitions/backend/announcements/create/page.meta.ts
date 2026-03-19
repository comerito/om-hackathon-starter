export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.announcements.manage'],
  pageTitle: 'New Announcement',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  breadcrumb: [
    { label: 'HackOn', href: '/backend/competitions' },
    { label: 'Announcements', href: '/backend/competitions/announcements' },
    { label: 'New' },
  ],
}
