import React from 'react'

const trophyIcon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('path', { d: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6' }),
  React.createElement('path', { d: 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18' }),
  React.createElement('path', { d: 'M4 22h16' }),
  React.createElement('path', { d: 'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22' }),
  React.createElement('path', { d: 'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22' }),
  React.createElement('path', { d: 'M18 2H6v7a6 6 0 0 0 12 0V2Z' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.view'],
  pageTitle: 'HackOn Platform',
  pageTitleKey: 'competitions.module.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 100,
  icon: trophyIcon,
  breadcrumb: [
    { label: 'HackOn Platform', labelKey: 'competitions.module.title' },
  ],
}
