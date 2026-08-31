export const metadata = {
  requireAuth: true,
  requireFeatures: ['teams.manage'],
  pageTitle: 'Add Resource',
  pageTitleKey: 'teams.resources.create.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  // Sub-route reached from its list page; must never be its own sidebar entry.
  navHidden: true,
  breadcrumb: [{ label: 'Resources', labelKey: 'teams.resources.title', href: '/backend/resources' },
    { label: 'Add', labelKey: 'teams.resources.create.title' }],
}
