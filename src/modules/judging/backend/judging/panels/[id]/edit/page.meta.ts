export const metadata = {
  requireAuth: true,
  requireFeatures: ['judging.panels.manage'],
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  navHidden: true,
  hideFromNav: true,
  breadcrumb: [
    { label: 'Judging', href: '/backend/judging' },
    { label: 'Edit Panel' },
  ],
}
