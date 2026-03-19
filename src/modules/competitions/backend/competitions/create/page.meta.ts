export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.create'],
  pageTitle: 'Create Competition',
  pageTitleKey: 'competitions.create.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 102,
  breadcrumb: [
    { label: 'HackOn', labelKey: 'competitions.module.title', href: '/backend/competitions' },
    { label: 'Competitions', labelKey: 'competitions.list.title', href: '/backend/competitions/competitions' },
    { label: 'Create', labelKey: 'competitions.create.title' },
  ],
}
