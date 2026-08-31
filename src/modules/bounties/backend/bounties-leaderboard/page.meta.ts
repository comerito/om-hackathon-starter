import React from 'react'

// lucide:list-ordered
const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('line', { x1: 10, y1: 6, x2: 21, y2: 6 }),
  React.createElement('line', { x1: 10, y1: 12, x2: 21, y2: 12 }),
  React.createElement('line', { x1: 10, y1: 18, x2: 21, y2: 18 }),
  React.createElement('path', { d: 'M4 6h1v4' }),
  React.createElement('path', { d: 'M4 10h2' }),
  React.createElement('path', { d: 'M6 18H4c0-1 2-2 2-3s-1-1.5-2-1' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['bounties.view'],
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 13,
  icon,
  pageTitle: 'Bounty Leaderboard',
  pageTitleKey: 'bounties.leaderboard.title',
  breadcrumb: [
    { label: 'Bounty Hunting', labelKey: 'bounties.judge.title', href: '/backend/bounties' },
    { label: 'Leaderboard', labelKey: 'bounties.leaderboard.title' },
  ],
}
