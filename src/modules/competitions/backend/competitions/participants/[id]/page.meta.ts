export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.participants.manage'],
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  navHidden: true,
  hideFromNav: true,
  breadcrumb: [
    { label: 'Participants', href: '/backend/competitions/participants' },
    { label: 'Details' },
  ],
}
