import React from 'react'

// lucide:plus-circle
const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('circle', { cx: 12, cy: 12, r: 10 }),
  React.createElement('path', { d: 'M8 12h8' }),
  React.createElement('path', { d: 'M12 8v8' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['tracks.create'],
  pageTitle: 'Create Track',
  pageTitleKey: 'tracks.create.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 202,
  icon,
  breadcrumb: [
    { label: 'Tracks', labelKey: 'tracks.list.title', href: '/backend/tracks' },
    { label: 'Create', labelKey: 'tracks.create.title' },
  ],
}
