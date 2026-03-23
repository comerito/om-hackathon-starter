"use client"

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePortalInjectedMenuItems } from '@open-mercato/ui/portal/hooks/usePortalInjectedMenuItems'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { useQuery } from '@tanstack/react-query'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Milestone } from 'lucide-react'
import { resolveIcon } from './icons'
import { MilestonesDrawer } from './MilestonesDrawer'
import { cn } from '@open-mercato/shared/lib/utils'

type PortalSidebarProps = {
  variant?: 'full' | 'minimal'
  competitionName?: string
  competitionSubtitle?: string
}

/** Navigation item ordering — sidebar shows items in this priority */
const NAV_ORDER: string[] = [
  'competitions.portal-dashboard',
  'competitions.portal-agenda',
  'tracks.portal-tracks',
  'competitions.portal-competition',
  'sponsors.portal-sponsors',
  'teams.portal-my-team',
  'competitions.portal-participants',
  'judging.portal-results',
  'judging.portal-presentations',
  'projects.portal-my-project',
  'judging.portal-judging',
  'competitions.portal-announcements',
  'sponsors.portal-voting',
  'competitions.portal-qr',
  'teams.portal-browse-teams',
  'incidents.portal-report',
]

/** Items to show in minimal (incident/support) sidebar variant */
const MINIMAL_IDS = new Set([
  'competitions.portal-dashboard',
  'teams.portal-my-team',
  'incidents.portal-report',
  'competitions.portal-agenda',
])

export function PortalSidebar({ variant = 'full', competitionName, competitionSubtitle }: PortalSidebarProps) {
  const pathname = usePathname()
  const { orgSlug } = usePortalContext()
  const [milestonesOpen, setMilestonesOpen] = React.useState(false)

  // Listen for external open requests (from dashboard milestone/deadline clicks)
  React.useEffect(() => {
    function handleOpen() { setMilestonesOpen(true) }
    window.addEventListener('open-milestones-drawer', handleOpen)
    return () => window.removeEventListener('open-milestones-drawer', handleOpen)
  }, [])

  // Get selected competition ID from localStorage (same key as CompetitionContext)
  const [selectedCompetitionId, setSelectedCompetitionId] = React.useState<string | null>(null)
  React.useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('hackon:selected-competition') : null
    setSelectedCompetitionId(stored)
  }, [])

  // Fetch competition for rules URL
  const { data: competitionData } = useQuery({
    queryKey: ['sidebar-competition', selectedCompetitionId],
    queryFn: async () => {
      if (!selectedCompetitionId) return null
      const { ok, result } = await apiCall<{ items: Array<{ id: string; rules_url?: string }> }>(
        `/api/competitions/portal/my-competitions`,
      )
      if (!ok || !result?.items) return null
      return result.items.find(c => c.id === selectedCompetitionId) ?? null
    },
    enabled: !!selectedCompetitionId,
  })
  const { items: mainItems } = usePortalInjectedMenuItems('menu:portal:sidebar:main')
  const { items: accountItems } = usePortalInjectedMenuItems('menu:portal:sidebar:account')

  const sortedItems = React.useMemo(() => {
    let items = [...mainItems, ...accountItems]

    if (variant === 'minimal') {
      items = items.filter((item) => MINIMAL_IDS.has(item.id))
    }

    items.sort((a, b) => {
      const aIdx = NAV_ORDER.indexOf(a.id)
      const bIdx = NAV_ORDER.indexOf(b.id)
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
    })

    return items
  }, [mainItems, accountItems, variant])

  const prefix = `/${orgSlug}/portal`

  return (
    <aside className="flex h-full w-[220px] flex-col border-r border-gray-100 bg-white">
      {/* Logo / competition name */}
      <div className="px-5 pt-6 pb-4">
        <Link href={`${prefix}/dashboard`} className="block">
          <h2 className="text-lg font-bold text-portal-primary leading-tight">
            {competitionName || 'Hackathon Hub'}
          </h2>
          {competitionSubtitle && (
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-portal-secondary">
              {competitionSubtitle}
            </p>
          )}
        </Link>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {sortedItems.map((item) => {
          const Icon = resolveIcon(item.icon)
          const isActive = item.href ? pathname === item.href || pathname.startsWith(item.href + '/') : false
          // Remap label for the design nav style
          const label = item.label

          return (
            <Link
              key={item.id}
              href={item.href ?? '#'}
              className={cn(
                'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-portal-primary/5 text-portal-primary'
                  : 'text-portal-secondary hover:bg-gray-50 hover:text-foreground'
              )}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-portal-primary" />
              )}
              <Icon className="size-[18px] shrink-0" />
              <span className="uppercase tracking-wide">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom: Milestones button + Join CTA */}
      <div className="p-4 space-y-2">
        {variant === 'full' && selectedCompetitionId && (
          <button
            type="button"
            onClick={() => setMilestonesOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-xs font-medium text-portal-secondary hover:bg-gray-50 hover:text-foreground transition-colors"
          >
            <Milestone className="size-4" />
            <span>Milestones</span>
          </button>
        )}
        {variant === 'minimal' ? (
          <Link
            href={`${prefix}/incident`}
            className="flex items-center gap-2 text-sm text-portal-secondary hover:text-foreground"
          >
            <span className="text-lg">?</span>
            <span>Support</span>
          </Link>
        ) : (
          <Link
            href={`${prefix}/competition`}
            className="flex w-full items-center justify-center rounded-lg bg-portal-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-portal-primary-light"
          >
            Join Hackathon
          </Link>
        )}
      </div>

      {/* Milestones Drawer */}
      <MilestonesDrawer
        competitionId={selectedCompetitionId}
        open={milestonesOpen}
        onClose={() => setMilestonesOpen(false)}
        orgSlug={orgSlug}
        rulesUrl={(competitionData as any)?.rules_url}
      />
    </aside>
  )
}
