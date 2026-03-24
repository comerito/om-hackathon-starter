export const metadata = {
  requireAuth: true,
  requireFeatures: ['incidents.manage'],
  pageTitle: 'Manage Incident',
  pageTitleKey: 'incidents.edit.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  breadcrumb: [
    { label: 'Incidents', labelKey: 'incidents.list.title', href: '/backend/incidents' },
    { label: 'Manage', labelKey: 'incidents.edit.title' },
  ],
}
