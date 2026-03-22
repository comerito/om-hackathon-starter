export const metadata = {
  requireAuth: true,
  requireFeatures: ['projects.edit'],
  pageTitle: 'Edit Project',
  pageTitleKey: 'projects.edit.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  breadcrumb: [
    { label: 'Projects', labelKey: 'projects.list.title', href: '/backend/projects' },
    { label: 'Edit', labelKey: 'projects.edit.title' },
  ],
}
