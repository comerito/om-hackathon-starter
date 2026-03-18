import React from 'react'
import { FolderCode } from 'lucide-react'

export const metadata = {
  icon: React.createElement(FolderCode, { className: 'size-4' }),
  requireAuth: true,
  requireFeatures: ['projects.view'],
  pageTitle: 'Projects',
  pageTitleKey: 'projects.page.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'hackon.nav.group',
  pageOrder: 500,
}
