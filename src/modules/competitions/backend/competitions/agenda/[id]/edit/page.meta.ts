export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.agenda.manage'],
  pageTitle: 'Edit Agenda Item',
  pageTitleKey: 'competitions.agenda.edit.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  breadcrumb: [
    { label: 'Agenda', labelKey: 'competitions.agenda.pageTitle', href: '/backend/competitions/agenda' },
    { label: 'Edit', labelKey: 'competitions.agenda.edit.title' },
  ],
}
