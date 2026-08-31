export const metadata = {
  requireAuth: true,
  requireFeatures: ['sponsors.prizes.manage'],
  pageTitle: 'Edit Prize',
  pageTitleKey: 'sponsors.prizes.edit.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  // Sub-route reached from its list page; must never be its own sidebar entry.
  navHidden: true,
  breadcrumb: [{ label: 'Sponsors & Prizes', labelKey: 'sponsors.list.title', href: '/backend/sponsors' },
    { label: 'Edit Prize', labelKey: 'sponsors.prizes.edit.title' }],
}
