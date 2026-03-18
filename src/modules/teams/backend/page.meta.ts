import React from 'react'
import { Users } from 'lucide-react'

export const metadata = {
  icon: React.createElement(Users, { className: 'size-4' }),
  requireAuth: true,
  requireFeatures: ['teams.view'],
  pageGroup: 'HackOn',
  order: 400,
}
