import React from 'react'
import { GitBranch } from 'lucide-react'

export const metadata = {
  icon: React.createElement(GitBranch, { className: 'size-4' }),
  requireAuth: true,
  requireFeatures: ['tracks.view'],
  pageTitle: 'Tracks',
  pageTitleKey: 'tracks.page.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'hackon.nav.group',
  pageOrder: 200,
}
