export const metadata = {
  requireAuth: true,
  requireFeatures: ['judging.panels.manage'],
  hideFromNav: true,
  breadcrumb: [
    { label: 'Judging', href: '/backend/judging' },
    { label: 'Edit Panel' },
  ],
}
