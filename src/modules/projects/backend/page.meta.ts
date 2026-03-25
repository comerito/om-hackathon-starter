import React from 'react'

// lucide:folder-code
const folderCodeIcon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('path', { d: 'M10 10.5 8 13l2 2.5' }),
  React.createElement('path', { d: 'm14 10.5 2 2.5-2 2.5' }),
  React.createElement('path', { d: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['projects.view'],
  pageTitle: 'Projects',
  pageTitleKey: 'projects.list.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 4,
  icon: folderCodeIcon,
  breadcrumb: [
    { label: 'Projects', labelKey: 'projects.list.title' },
  ],
}
