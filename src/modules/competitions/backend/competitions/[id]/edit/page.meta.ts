export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.edit'],
  pageTitle: 'Edit Competition',
  pageTitleKey: 'competitions.edit.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  breadcrumb: [
    { label: 'HackOn', labelKey: 'competitions.module.title', href: '/backend/competitions' },
    { label: 'Competitions', labelKey: 'competitions.list.title', href: '/backend/competitions/competitions' },
    { label: 'Edit', labelKey: 'competitions.edit.title' },
  ],
}
