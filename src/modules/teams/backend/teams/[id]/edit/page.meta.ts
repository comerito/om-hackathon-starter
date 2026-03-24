export const metadata = {
  requireAuth: true,
  requireFeatures: ['teams.edit'],
  pageTitle: 'Edit Team',
  pageTitleKey: 'teams.edit.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  breadcrumb: [
    { label: 'Teams', labelKey: 'teams.list.title', href: '/backend/teams' },
    { label: 'Edit', labelKey: 'teams.edit.title' },
  ],
}
