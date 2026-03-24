import React from 'react'

// lucide:user-plus
const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }),
  React.createElement('circle', { cx: 9, cy: 7, r: 4 }),
  React.createElement('line', { x1: 19, y1: 8, x2: 19, y2: 14 }),
  React.createElement('line', { x1: 22, y1: 11, x2: 16, y2: 11 }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.participants.manage'],
  pageTitle: 'Add Participant',
  pageTitleKey: 'competitions.participants.form.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  icon,
  breadcrumb: [
    { label: 'Participants', labelKey: 'competitions.participants.title', href: '/backend/competitions/participants' },
    { label: 'Add', labelKey: 'competitions.participants.form.title' },
  ],
}
