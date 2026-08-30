export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.edit'],
  pageTitle: 'Edit Info Card',
  pageTitleKey: 'competitions.infoCards.edit.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  // Sub-route reached from its list page; must never be its own sidebar entry.
  navHidden: true,
  breadcrumb: [{ label: 'Info Cards', labelKey: 'competitions.infoCards.title', href: '/backend/competitions/info-cards' },
    { label: 'Edit', labelKey: 'competitions.infoCards.edit.title' }],
}
