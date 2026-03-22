"use client"
import * as React from 'react'
import { CompetitionProvider } from './CompetitionContext'
import { CompetitionSelector } from './CompetitionSelector'

export function PortalCompetitionLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompetitionProvider>
      <CompetitionSelector />
      {children}
    </CompetitionProvider>
  )
}
