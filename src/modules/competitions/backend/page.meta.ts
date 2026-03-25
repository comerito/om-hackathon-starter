import React from 'react'

const trophyIcon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6' }),
  React.createElement('path', { d: 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18' }),
  React.createElement('path', { d: 'M18 2H6v7a6 6 0 0 0 12 0V2Z' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.view'],
  pageTitle: 'Competitions',
  pageTitleKey: 'competitions.list.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 1,
  icon: trophyIcon,
  breadcrumb: [
    { label: 'Competitions', labelKey: 'competitions.list.title' },
  ],
}
