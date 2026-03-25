export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.participants.manage'],
  hideFromNav: true,
  breadcrumb: [
    { label: 'Participants', href: '/backend/competitions/participants' },
    { label: 'Details' },
  ],
}
