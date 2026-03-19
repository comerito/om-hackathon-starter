export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.agenda.manage'],
  pageTitle: 'Add Agenda Item',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  breadcrumb: [
    { label: 'HackOn', href: '/backend/competitions' },
    { label: 'Agenda', href: '/backend/competitions/agenda' },
    { label: 'Add Item' },
  ],
}
