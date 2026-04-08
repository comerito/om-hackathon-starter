"use client"

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { usePortalEventBridge } from '@open-mercato/ui/portal/hooks/usePortalEventBridge'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import dynamic from 'next/dynamic'
import { PortalSidebar } from './PortalSidebar'
import { PortalTopBar } from './PortalTopBar'
import { PortalFooter } from './PortalFooter'

const MilestonesDrawer = dynamic(() => import('./MilestonesDrawer').then(m => ({ default: m.MilestonesDrawer })), { ssr: false })
const CompetitionGuideDrawer = dynamic(() => import('./CompetitionGuideDrawer').then(m => ({ default: m.CompetitionGuideDrawer })), { ssr: false })

export type PortalLayoutVariant = 'full' | 'minimal' | 'topnav' | 'kiosk'

/** Only mount event bridge when user is actually authenticated */
function EventBridge() {
  const { auth } = usePortalContext()
  // Skip SSE connection if no user — prevents 401 spam
  if (!auth.user) return null
  return <EventBridgeInner />
}

function EventBridgeInner() {
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
  userName,
  userRole,
  backHref,
  navLinks,
}: HackathonPortalLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [milestonesOpen, setMilestonesOpen] = React.useState(false)
  const [competitionGuideOpen, setCompetitionGuideOpen] = React.useState(false)
  const [competitionGuideStage, setCompetitionGuideStage] = React.useState<string | null>(null)
  const pathname = usePathname()
  const { orgSlug } = usePortalContext()

  // Read competition ID from localStorage (same key as CompetitionContext)
  const [selectedCompetitionId, setSelectedCompetitionId] = React.useState<string | null>(null)
  React.useEffect(() => {
    setSelectedCompetitionId(typeof window !== 'undefined' ? localStorage.getItem('hackon:selected-competition') : null)
  }, [])

  // Close mobile menu on route change
  React.useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // Listen for milestones drawer open requests (from dashboard, sidebar button, etc.)
  React.useEffect(() => {
    function handleOpen() { setMilestonesOpen(true) }
    window.addEventListener('open-milestones-drawer', handleOpen)
    return () => window.removeEventListener('open-milestones-drawer', handleOpen)
  }, [])

  React.useEffect(() => {
    function handleOpen(event: Event) {
      const detail = event instanceof CustomEvent ? event.detail as { currentStage?: string | null } | undefined : undefined
      setCompetitionGuideStage(detail?.currentStage ?? null)
      setCompetitionGuideOpen(true)
    }
    window.addEventListener('open-competition-guide-drawer', handleOpen as EventListener)
    return () => window.removeEventListener('open-competition-guide-drawer', handleOpen as EventListener)
  }, [])

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

          navLinks={navLinks}
          userName={userName}
          userRole={userRole}
        />
        <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
          {children}
        </main>
      </div>
    )
  }

  // Variant A (full) & B (minimal) — sidebar + top bar
  const sidebarVariant = variant === 'minimal' ? 'minimal' : 'full'

  return (
    <div className="flex min-h-screen bg-portal-bg overflow-x-hidden">
      {enableEventBridge && <EventBridge />}

      {/* Milestones Drawer — rendered at layout level so it works on all screen sizes */}
      {milestonesOpen && (
        <MilestonesDrawer
          competitionId={selectedCompetitionId}
          open={milestonesOpen}
          onClose={() => setMilestonesOpen(false)}
          orgSlug={orgSlug}
        />
      )}
      {competitionGuideOpen && (
        <CompetitionGuideDrawer
          open={competitionGuideOpen}
          onClose={() => setCompetitionGuideOpen(false)}
          currentStage={competitionGuideStage}
        />
      )}

      {/* Desktop sidebar — fixed, hidden below lg */}
      <div className="hidden lg:flex lg:fixed lg:inset-y-0 lg:z-40">
        <PortalSidebar
          variant={sidebarVariant}
          competitionName={competitionName}
          competitionSubtitle={competitionSubtitle}
        />
      </div>

      {/* Mobile sidebar drawer — visible below lg when open */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
        {/* Drawer */}
        <div
          className={`relative z-10 h-full w-[280px] max-w-[calc(100vw-48px)] transform transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <PortalSidebar
            variant="full"
            competitionName={competitionName}
            competitionSubtitle={competitionSubtitle}
            onClose={() => setMobileMenuOpen(false)}
          />
        </div>
      </div>

      {/* Main area offset by sidebar width on desktop */}
      <div className="flex flex-1 flex-col lg:pl-[220px] min-w-0">
        <PortalTopBar
          variant={variant === 'minimal' ? 'minimal' : 'full'}
          title={topBarTitle}

          userName={userName}
          userRole={userRole}
          backHref={backHref}
          onMenuToggle={() => setMobileMenuOpen(prev => !prev)}
          mobileMenuOpen={mobileMenuOpen}
        />
        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 min-w-0">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
        {variant === 'minimal' && <PortalFooter />}
      </div>
    </div>
  )
}
