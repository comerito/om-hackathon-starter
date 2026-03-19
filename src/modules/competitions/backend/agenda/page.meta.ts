export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.agenda.manage'],
  pageTitle: 'Agenda',
  pageTitleKey: 'competitions.agenda.pageTitle',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 110,
  breadcrumb: [
    { label: 'HackOn', labelKey: 'competitions.module.title', href: '/backend/competitions' },
    { label: 'Agenda', labelKey: 'competitions.agenda.pageTitle' },
  ],
}
