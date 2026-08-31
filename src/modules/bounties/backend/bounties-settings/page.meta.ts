import React from 'react'

// lucide:sliders-horizontal
const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('line', { x1: 21, y1: 6, x2: 3, y2: 6 }),
  React.createElement('line', { x1: 21, y1: 12, x2: 3, y2: 12 }),
  React.createElement('line', { x1: 21, y1: 18, x2: 3, y2: 18 }),
  React.createElement('circle', { cx: 9, cy: 6, r: 2 }),
  React.createElement('circle', { cx: 15, cy: 12, r: 2 }),
  React.createElement('circle', { cx: 7, cy: 18, r: 2 }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['bounties.view'],
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 14,
  icon,
  pageTitle: 'Bounty Settings',
  pageTitleKey: 'bounties.settings.title',
  breadcrumb: [
    { label: 'Bounty Hunting', labelKey: 'bounties.judge.title', href: '/backend/bounties' },
    { label: 'Settings', labelKey: 'bounties.settings.title' },
  ],
}
