import React from 'react'
import { Gavel } from 'lucide-react'

export const metadata = {
  icon: React.createElement(Gavel, { className: 'size-4' }),
  requireAuth: true,
  requireFeatures: ['judging.view'],
  pageGroup: 'HackOn',
  order: 600,
}
