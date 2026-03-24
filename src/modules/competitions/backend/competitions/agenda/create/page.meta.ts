export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.agenda.manage'],
  pageTitle: 'Add Agenda Item',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  breadcrumb: [
    { label: 'Agenda', labelKey: 'competitions.agenda.pageTitle', href: '/backend/competitions/agenda' },
    { label: 'Add Item' },
  ],
}
