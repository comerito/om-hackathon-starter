export const metadata = {
  requireAuth: true,
  requireFeatures: ['tracks.edit'],
  pageTitle: 'Edit Track',
  pageTitleKey: 'tracks.edit.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  breadcrumb: [
    { label: 'Tracks', labelKey: 'tracks.list.title', href: '/backend/tracks' },
    { label: 'Edit', labelKey: 'tracks.edit.title' },
  ],
}
