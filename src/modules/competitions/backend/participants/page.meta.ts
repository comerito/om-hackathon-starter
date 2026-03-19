export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.participants.manage'],
  pageTitle: 'Participants',
  pageTitleKey: 'competitions.participants.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 105,
  breadcrumb: [
    { label: 'HackOn', labelKey: 'competitions.module.title', href: '/backend/competitions' },
    { label: 'Participants', labelKey: 'competitions.participants.title' },
  ],
}
