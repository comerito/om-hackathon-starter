"use client"

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePortalInjectedMenuItems } from '@open-mercato/ui/portal/hooks/usePortalInjectedMenuItems'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import dynamic from 'next/dynamic'
import { Milestone } from 'lucide-react'
import { resolveIcon } from './icons'
import { cn } from '@open-mercato/shared/lib/utils'

const MilestonesDrawer = dynamic(() => import('./MilestonesDrawer').then(m => ({ default: m.MilestonesDrawer })), { ssr: false })

type PortalSidebarProps = {
  variant?: 'full' | 'minimal'
  competitionName?: string
  competitionSubtitle?: string
}

/** Navigation item ordering — sidebar shows items in this priority */
const NAV_ORDER: string[] = [
  // Main (no group header)
  'competitions.portal-dashboard',
  'competitions.portal-agenda',
  'competitions.portal-announcements',
  // Hackathon
  'competitions.portal-competition',
  'tracks.portal-tracks',
  'teams.portal-my-team',
  'projects.portal-my-project',
  // Community
  'competitions.portal-participants',
  'teams.portal-browse-teams',
  'sponsors.portal-sponsors',
  // Judging & Results
  'judging.portal-presentations',
  'judging.portal-results',
  'sponsors.portal-voting',
  'judging.portal-judging',
  // Tools
  'competitions.portal-qr',
  'incidents.portal-report',
]

/** Group definitions for rendering separators */
type NavGroup = { id: string; label: string; itemIds: string[] }
const NAV_GROUPS: NavGroup[] = [
  { id: 'main', label: '', itemIds: ['competitions.portal-dashboard', 'competitions.portal-agenda', 'competitions.portal-announcements'] },
  { id: 'hackathon', label: 'Hackathon', itemIds: ['competitions.portal-competition', 'tracks.portal-tracks', 'teams.portal-my-team', 'projects.portal-my-project', 'competitions.portal-participants', 'teams.portal-browse-teams', 'sponsors.portal-sponsors'] },
  { id: 'results', label: 'Judging & Results', itemIds: ['judging.portal-presentations', 'judging.portal-results', 'sponsors.portal-voting', 'judging.portal-judging'] },
  { id: 'tools', label: 'Tools', itemIds: ['competitions.portal-qr', 'incidents.portal-report'] },
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

      {/* Navigation items — grouped */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          // Filter to items that exist in injected items
          const groupItems = group.itemIds
            .map(id => sortedItems.find(item => item.id === id))
            .filter(Boolean) as typeof sortedItems

          if (groupItems.length === 0) return null

          return (
            <div key={group.id} className={group.label ? 'mt-4 first:mt-0' : ''}>
              {group.label && (
                <p className="px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-portal-secondary/50">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {groupItems.map((item) => {
                  const Icon = resolveIcon(item.icon)
                  const isActive = item.href ? pathname === item.href || pathname.startsWith(item.href + '/') : false

                  return (
                    <Link
                      key={item.id}
                      href={item.href ?? '#'}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
                        isActive
                          ? 'bg-portal-primary/5 text-portal-primary'
                          : 'text-portal-secondary hover:bg-gray-50 hover:text-foreground'
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-portal-primary" />
                      )}
                      <Icon className="size-[18px] shrink-0" />
                      <span className="uppercase tracking-wide">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
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

      {/* Milestones Drawer — only mount when open to avoid useQuery issues */}
      {milestonesOpen && (
        <MilestonesDrawer
          competitionId={selectedCompetitionId}
          open={milestonesOpen}
          onClose={() => setMilestonesOpen(false)}
          orgSlug={orgSlug}
        />
      )}
    </aside>
  )
}
