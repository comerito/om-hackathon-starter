"use client"

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePortalInjectedMenuItems } from '@open-mercato/ui/portal/hooks/usePortalInjectedMenuItems'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Milestone } from 'lucide-react'
import { resolveIcon } from './icons'
import { cn } from '@open-mercato/shared/lib/utils'

type PortalSidebarProps = {
  variant?: 'full' | 'minimal'
  competitionName?: string
  competitionSubtitle?: string
  /** Called when a nav item is tapped in the mobile drawer */
  onClose?: () => void
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
  // Bounty Hunting
  'bounties.portal-leaderboard',
  'bounties.portal-my-prs',
  // Tools
  'competitions.portal-qr',
  'incidents.portal-report',
]

/** Group definitions for rendering separators */
type NavGroup = { id: string; labelKey?: string; fallbackLabel: string; itemIds: string[] }
const NAV_GROUPS: NavGroup[] = [
  { id: 'main', fallbackLabel: '', itemIds: ['competitions.portal-dashboard', 'competitions.portal-agenda', 'competitions.portal-announcements'] },
  { id: 'hackathon', labelKey: 'portal.sidebar.group.hackathon', fallbackLabel: 'Hackathon', itemIds: ['competitions.portal-competition', 'tracks.portal-tracks', 'teams.portal-my-team', 'projects.portal-my-project', 'competitions.portal-participants', 'teams.portal-browse-teams', 'sponsors.portal-sponsors'] },
  { id: 'results', labelKey: 'portal.sidebar.group.results', fallbackLabel: 'Judging & Results', itemIds: ['judging.portal-presentations', 'judging.portal-results', 'sponsors.portal-voting', 'judging.portal-judging'] },
  { id: 'bounties', labelKey: 'portal.sidebar.group.bounties', fallbackLabel: 'Bounty Hunting', itemIds: ['bounties.portal-leaderboard', 'bounties.portal-my-prs'] },
  { id: 'tools', labelKey: 'portal.sidebar.group.tools', fallbackLabel: 'Tools', itemIds: ['competitions.portal-qr', 'incidents.portal-report'] },
]

/** Items to show in minimal (incident/support) sidebar variant */
const MINIMAL_IDS = new Set([
  'competitions.portal-dashboard',
  'teams.portal-my-team',
  'incidents.portal-report',
  'competitions.portal-agenda',
])

/** Stage ordering for visibility comparisons */
const STAGE_INDEX: Record<string, number> = {
  draft: 0, open: 1, team_formation: 2, track_selection: 3,
  hacking: 4, demos: 5, deliberation: 6, finished: 7, archived: 8,
}

/** Nav items hidden until competition reaches a minimum stage.
 *  `roles`: restrict only these roles (omit to apply to all roles) */
const MIN_STAGE_FOR_ITEM: Array<{ id: string; minStage: string; roles?: string[] }> = [
  { id: 'projects.portal-my-project', minStage: 'team_formation' },
  { id: 'judging.portal-presentations', minStage: 'demos', roles: ['participant'] },
  { id: 'judging.portal-results', minStage: 'deliberation', roles: ['participant'] },
  { id: 'sponsors.portal-voting', minStage: 'demos', roles: ['participant'] },
]

export function PortalSidebar({ variant = 'full', competitionName, competitionSubtitle, onClose }: PortalSidebarProps) {
  const t = useT()
  const pathname = usePathname()
  const { orgSlug } = usePortalContext()

  // Get selected competition ID, stage, and role from localStorage (same keys as CompetitionContext)
  const [selectedCompetitionId, setSelectedCompetitionId] = React.useState<string | null>(null)
  const [competitionStage, setCompetitionStage] = React.useState<string | null>(null)
  const [competitionRole, setCompetitionRole] = React.useState<string | null>(null)
  React.useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('hackon:selected-competition') : null
    const stage = typeof window !== 'undefined' ? localStorage.getItem('hackon:selected-competition-stage') : null
    const role = typeof window !== 'undefined' ? localStorage.getItem('hackon:selected-competition-role') : null
    setSelectedCompetitionId(stored)
    setCompetitionStage(stage)
    setCompetitionRole(role)
  }, [])
  const { items: mainItems } = usePortalInjectedMenuItems('menu:portal:sidebar:main')
  const { items: accountItems } = usePortalInjectedMenuItems('menu:portal:sidebar:account')

  const sortedItems = React.useMemo(() => {
    let items = [...mainItems, ...accountItems]

    if (variant === 'minimal') {
      items = items.filter((item) => MINIMAL_IDS.has(item.id))
    }

    // Hide nav items that require a minimum competition stage
    const currentStageIdx = competitionStage ? (STAGE_INDEX[competitionStage] ?? -1) : -1
    items = items.filter((item) => {
      const rule = MIN_STAGE_FOR_ITEM.find(r => r.id === item.id)
      if (!rule) return true
      // If the rule is role-scoped, skip it for non-matching roles
      if (rule.roles && competitionRole && !rule.roles.includes(competitionRole)) return true
      if (currentStageIdx < 0) return false // stage unknown — hide stage-gated items
      return currentStageIdx >= (STAGE_INDEX[rule.minStage] ?? 0)
    })

    items.sort((a, b) => {
      const aIdx = NAV_ORDER.indexOf(a.id)
      const bIdx = NAV_ORDER.indexOf(b.id)
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
    })

    return items
  }, [mainItems, accountItems, variant, competitionStage])

  const prefix = `/${orgSlug}/portal`

  return (
    <aside className="flex h-full w-[220px] flex-col border-r border-gray-100 dark:border-white/10 bg-white dark:bg-slate-900">
      {/* Logo / competition name */}
      <div className="px-5 pt-6 pb-4">
        <Link href={`${prefix}/dashboard`} className="block">
          <h2 className="text-lg font-bold text-portal-primary leading-tight">
            {competitionName || t('portal.sidebar.hub', 'Hackathon Hub')}
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
            <div key={group.id} className={group.fallbackLabel ? 'mt-4 first:mt-0' : ''}>
              {group.fallbackLabel && (
                <p className="px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-portal-secondary/50">
                  {group.labelKey ? t(group.labelKey, group.fallbackLabel) : group.fallbackLabel}
                </p>
              )}
              <div className="space-y-0.5">
                {groupItems.map((item) => {
                  const Icon = resolveIcon(item.icon)
                  const isActive = item.href ? pathname === item.href || pathname.startsWith(item.href + '/') : false
                  const itemLabel =
                    item.labelKey && item.label
                      ? t(item.labelKey, item.label)
                      : item.labelKey
                        ? t(item.labelKey, item.id)
                        : item.label

                  return (
                    <Link
                      key={item.id}
                      href={item.href ?? '#'}
                      onClick={onClose}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
                        isActive
                          ? 'bg-portal-primary/5 text-portal-primary'
                          : 'text-portal-secondary hover:bg-gray-50 dark:hover:bg-white/5 hover:text-foreground'
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-portal-primary" />
                      )}
                      <Icon className="size-[18px] shrink-0" />
                      <span className="uppercase tracking-wide">{itemLabel}</span>
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
            onClick={() => { window.dispatchEvent(new Event('open-milestones-drawer')); onClose?.() }}
            className="flex w-full items-center gap-2 rounded-lg border border-gray-100 dark:border-white/10 px-3 py-2 text-xs font-medium text-portal-secondary hover:bg-gray-50 dark:hover:bg-white/5 hover:text-foreground transition-colors"
          >
            <Milestone className="size-4" />
            <span>{t('portal.sidebar.milestones', 'Milestones')}</span>
          </button>
        )}
        {variant === 'minimal' ? (
          <Link
            href={`${prefix}/incident`}
            className="flex items-center gap-2 text-sm text-portal-secondary hover:text-foreground"
          >
            <span className="text-lg">?</span>
            <span>{t('portal.sidebar.support', 'Support')}</span>
          </Link>
        ) : (
          <Link
            href={`${prefix}/competition`}
            onClick={onClose}
            className="flex w-full items-center justify-center rounded-lg bg-portal-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-portal-primary-light"
          >
            {t('portal.sidebar.joinHackathon', 'Join Hackathon')}
          </Link>
        )}
      </div>

    </aside>
  )
}
