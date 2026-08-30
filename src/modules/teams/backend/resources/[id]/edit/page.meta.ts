export const metadata = {
  requireAuth: true,
  requireFeatures: ['teams.manage'],
  pageTitle: 'Edit Resource',
  pageTitleKey: 'teams.resources.edit.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  // Sub-route reached from its list page; must never be its own sidebar entry.
  navHidden: true,
  breadcrumb: [{ label: 'Resources', labelKey: 'teams.resources.title', href: '/backend/resources' },
    { label: 'Edit', labelKey: 'teams.resources.edit.title' }],
}
