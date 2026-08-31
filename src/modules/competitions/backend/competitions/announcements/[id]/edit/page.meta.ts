export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.announcements.manage'],
  pageTitle: 'Edit Announcement',
  pageTitleKey: 'competitions.announcements.edit.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  // Sub-route reached from its list page; must never be its own sidebar entry.
  navHidden: true,
  breadcrumb: [{ label: 'Announcements', labelKey: 'competitions.announcements.title', href: '/backend/competitions/announcements' },
    { label: 'Edit', labelKey: 'competitions.announcements.edit.title' }],
}
