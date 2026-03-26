"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { Input } from '@open-mercato/ui/primitives/input'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { cn } from '@open-mercato/shared/lib/utils'
import { MessageCircle, SlidersHorizontal } from 'lucide-react'
import { PortalCompetitionLayout } from '../../../../components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../components/CompetitionContext'
import { PortalPageTitle, PortalBadge, ActionLink } from '@/components/portal'

/* ---------- types ---------- */

type Participant = {
  customer_user_id: string
  display_name: string
  email: string
  role: string
  organization: string | null
  skills: string[]
  looking_for_team: boolean
  bio: string | null
}

/* ---------- avatar colors by role ---------- */

const avatarColorsByRole: Record<string, string> = {
  participant: 'bg-blue-100 text-blue-700',
  mentor: 'bg-purple-100 text-purple-700',
  judge: 'bg-amber-100 text-amber-700',
}

const roleBadgeVariant: Record<string, 'primary' | 'info' | 'warning'> = {
  participant: 'primary',
  mentor: 'info',
  judge: 'warning',
}

const roleActionLabel: Record<string, string> = {
  participant: 'View Portfolio',
  mentor: 'Book Office Hours',
  judge: 'View Profile',
}

/* ---------- filter tab data ---------- */

type FilterTab = {
  id: string
  label: string
  count?: number
  disabled?: boolean
}

const FILTER_TABS: FilterTab[] = [
  { id: 'all', label: 'All', count: 1248 },
  { id: 'designers', label: 'Designers', disabled: true },
  { id: 'developers', label: 'Developers', disabled: true },
  { id: 'strategists', label: 'Strategists', disabled: true },
]

/* ---------- page size ---------- */

const PAGE_SIZE = 24

/* ---------- participant card ---------- */

function ParticipantCard({ p }: { p: Participant }) {
  const initials = p.display_name
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const avatarColors = avatarColorsByRole[p.role] ?? 'bg-gray-100 text-gray-700'
  const badgeVariant = roleBadgeVariant[p.role] ?? 'default'
  const actionLabel = roleActionLabel[p.role] ?? 'View Profile'

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 sm:p-5">
      {/* Header: Avatar + Name + Email */}
      <div className="relative flex items-start gap-3 mb-3">
        <div className="relative shrink-0">
          <div
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold',
              avatarColors,
            )}
          >
            {initials}
          </div>
          {p.looking_for_team && (
            <span className="absolute -top-1.5 -right-1.5 inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-green-700 whitespace-nowrap">
              Looking for team
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="font-semibold text-sm truncate text-foreground">{p.display_name}</h3>
          <p className="text-xs text-portal-secondary truncate">{p.email}</p>
        </div>
      </div>

      {/* Role Badge + Organization */}
      <div className="flex items-center gap-2 mb-3">
        <PortalBadge variant={badgeVariant}>{p.role}</PortalBadge>
        {p.organization && (
          <>
            <span className="text-gray-300">&middot;</span>
            <span className="text-xs text-portal-secondary truncate">{p.organization}</span>
          </>
        )}
      </div>

      {/* Skills Tags */}
      {p.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {p.skills.slice(0, 5).map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600"
            >
              {skill}
            </span>
          ))}
          {p.skills.length > 5 && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">
              +{p.skills.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Bottom Row: Action Link + Message Button */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <ActionLink href="#" arrow>
          {actionLabel}
        </ActionLink>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          aria-label={`Message ${p.display_name}`}
        >
          <MessageCircle className="size-4" />
        </button>
      </div>
    </div>
  )
}

/* ---------- filter tabs bar ---------- */

function FilterTabs({ totalCount }: { totalCount: number }) {
  const [activeTab] = React.useState('all')

  const tabs = React.useMemo(() => {
    return FILTER_TABS.map((tab) =>
      tab.id === 'all' ? { ...tab, count: totalCount } : tab,
    )
  }, [totalCount])

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="overflow-x-auto">
        <div className="flex items-center gap-1 rounded-lg bg-gray-50 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              disabled={tab.disabled}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
                tab.disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              {tab.label}
              {tab.count != null && (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    activeTab === tab.id
                      ? 'bg-portal-primary/10 text-portal-primary'
                      : 'bg-gray-200 text-gray-500',
                  )}
                >
                  {tab.count.toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <SlidersHorizontal className="size-3.5" />
        Advanced Filters
      </button>
    </div>
  )
}

/* ---------- participants content ---------- */

function ParticipantsContent() {
  const t = useT()
  const { selectedId } = useCompetitionContext()
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE)

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reset visible count when search changes
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [debouncedSearch])

  const { data, isLoading } = useQuery({
    queryKey: ['portal-participants', selectedId, debouncedSearch],
    queryFn: async () => {
      if (!selectedId) return { items: [] as Participant[] }
      const searchParam = debouncedSearch.length >= 2 ? `&search=${encodeURIComponent(debouncedSearch)}` : ''
      const { ok, result } = await apiCall<{ items: Participant[] }>(
        `/api/competitions/portal/participants?competition_id=${selectedId}${searchParam}`,
      )
      if (!ok || !result) throw new Error('Failed to load participants')
      return result
    },
    enabled: !!selectedId,
  })

  const participants = data?.items ?? []
  const visibleParticipants = participants.slice(0, visibleCount)
  const hasMore = visibleCount < participants.length

  if (!selectedId) {
    return (
      <PortalEmptyState
        title={t('competitions.portal.participants.noCompetition', 'Select a competition')}
        description={t('competitions.portal.participants.noCompetitionDesc', 'Choose a competition to view its participants.')}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Search + Filters */}
      <div className="space-y-4">
        <div className="max-w-md">
          <Input
            placeholder={t('competitions.portal.participants.searchPlaceholder', 'Search participants by name or email...')}
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>
        <FilterTabs totalCount={participants.length} />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center">
          <div className="text-sm text-portal-secondary">
            {t('common.loading', 'Loading...')}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && participants.length === 0 && (
        <PortalEmptyState
          title={t('competitions.portal.participants.empty', 'No participants found')}
          description={
            debouncedSearch
              ? t('competitions.portal.participants.emptySearch', 'Try a different search term.')
              : t('competitions.portal.participants.emptyDesc', 'No one has joined this competition yet.')
          }
        />
      )}

      {/* Participant Cards Grid */}
      {!isLoading && participants.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleParticipants.map((p) => (
              <ParticipantCard key={p.customer_user_id} p={p} />
            ))}
          </div>

          {/* Load More + Count */}
          <div className="flex flex-col items-center gap-2 pt-2">
            {hasMore && (
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-6 py-2.5 text-sm font-medium text-foreground hover:bg-gray-50 transition-colors"
              >
                Load More Participants
              </button>
            )}
            <p className="text-xs text-portal-secondary">
              Showing {visibleParticipants.length} of {participants.length} participants
            </p>
          </div>
        </>
      )}
    </div>
  )
}

/* ---------- page component ---------- */

export default function ParticipantsPortalPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <PortalCompetitionLayout>
      <PortalPageTitle
        label="Network Hub"
        title="Participants Directory"
      />
      <ParticipantsContent />
    </PortalCompetitionLayout>
  )
}
