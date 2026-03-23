"use client"

import * as React from 'react'
import { usePortalEventBridge } from '@open-mercato/ui/portal/hooks/usePortalEventBridge'
import { PortalSidebar } from './PortalSidebar'
import { PortalTopBar } from './PortalTopBar'
import { PortalFooter } from './PortalFooter'

export type PortalLayoutVariant = 'full' | 'minimal' | 'topnav' | 'kiosk'

/** Tiny component to mount event bridge hook (can't conditionally call hooks) */
function EventBridge() {
  usePortalEventBridge()
  return null
}

type HackathonPortalLayoutProps = {
  children: React.ReactNode
  /** Enable SSE event bridge for real-time updates */
  enableEventBridge?: boolean
  /** Layout variant:
   *  - full: sidebar + top bar + two-column content (most pages)
   *  - minimal: narrow sidebar + top bar + single column + footer (incident pages)
   *  - topnav: no sidebar, top nav links + two-column content (project submission)
   *  - kiosk: no chrome, full-screen dark (kiosk display)
   */
  variant?: PortalLayoutVariant
  /** Competition name shown in sidebar */
  competitionName?: string
  /** Subtitle shown under competition name */
  competitionSubtitle?: string
  /** Title shown in top bar (e.g. section name) */
  topBarTitle?: string
  /** Search placeholder */
  searchPlaceholder?: string
  /** User display name */
  userName?: string
  /** User role label */
  userRole?: string
  /** Back link (minimal variant) */
  backHref?: string
  /** Inline nav links (topnav variant) */
  navLinks?: Array<{ label: string; href: string; active?: boolean }>
}

/**
 * Hackathon portal layout shell with 4 variants matching the redesign spec.
 *
 * Must be rendered INSIDE PortalProvider (which provides auth + tenant context).
 */
export function HackathonPortalLayout({
  children,
  enableEventBridge = false,
  variant = 'full',
  competitionName,
  competitionSubtitle,
  topBarTitle,
  searchPlaceholder,
  userName,
  userRole,
  backHref,
  navLinks,
}: HackathonPortalLayoutProps) {
  // Variant D: Kiosk — no chrome at all
  if (variant === 'kiosk') {
    return (
      <div className="min-h-screen bg-portal-dark text-white">
        {enableEventBridge && <EventBridge />}
        {children}
      </div>
    )
  }

  // Variant C: Top-nav only — no sidebar
  if (variant === 'topnav') {
    return (
      <div className="min-h-screen bg-portal-bg">
        {enableEventBridge && <EventBridge />}
        <PortalTopBar
          variant="topnav"
          title={topBarTitle}
          searchPlaceholder={searchPlaceholder}
          navLinks={navLinks}
          userName={userName}
          userRole={userRole}
        />
        <main className="mx-auto max-w-7xl px-6 py-6">
          {children}
        </main>
      </div>
    )
  }

  // Variant A (full) & B (minimal) — sidebar + top bar
  const sidebarVariant = variant === 'minimal' ? 'minimal' : 'full'

  return (
    <div className="flex min-h-screen bg-portal-bg">
      {enableEventBridge && <EventBridge />}
      {/* Fixed sidebar */}
      <div className="hidden lg:flex lg:fixed lg:inset-y-0 lg:z-40">
        <PortalSidebar
          variant={sidebarVariant}
          competitionName={competitionName}
          competitionSubtitle={competitionSubtitle}
        />
      </div>

      {/* Main area offset by sidebar width */}
      <div className="flex flex-1 flex-col lg:pl-[220px]">
        <PortalTopBar
          variant={variant === 'minimal' ? 'minimal' : 'full'}
          title={topBarTitle}
          searchPlaceholder={searchPlaceholder}
          userName={userName}
          userRole={userRole}
          backHref={backHref}
        />
        <main className="flex-1 px-6 py-6">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
        {variant === 'minimal' && <PortalFooter />}
      </div>
    </div>
  )
}
