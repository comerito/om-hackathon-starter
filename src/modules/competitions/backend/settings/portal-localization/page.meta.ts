import React from 'react'

// lucide:languages
const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('path', { d: 'm5 8 6 6' }),
  React.createElement('path', { d: 'm4 14 6-6 2-3' }),
  React.createElement('path', { d: 'M2 5h12' }),
  React.createElement('path', { d: 'M7 2h1' }),
  React.createElement('path', { d: 'm22 22-5-10-5 10' }),
  React.createElement('path', { d: 'M14 18h6' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.edit'],
  pageTitle: 'Portal Localization',
  pageTitleKey: 'competitions.portalLocalization.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 17,
  icon,
  breadcrumb: [{ label: 'Portal Localization', labelKey: 'competitions.portalLocalization.title' }],
}
