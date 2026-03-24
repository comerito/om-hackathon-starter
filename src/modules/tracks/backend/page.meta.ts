import React from 'react'

// lucide:git-branch
const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('line', { x1: 6, y1: 3, x2: 6, y2: 15 }),
  React.createElement('circle', { cx: 18, cy: 6, r: 3 }),
  React.createElement('circle', { cx: 6, cy: 18, r: 3 }),
  React.createElement('path', { d: 'M18 9a9 9 0 0 1-9 9' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['tracks.view'],
  pageTitle: 'Tracks',
  pageTitleKey: 'tracks.list.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 101,
  icon,
  breadcrumb: [
    { label: 'Tracks', labelKey: 'tracks.list.title' },
  ],
}
