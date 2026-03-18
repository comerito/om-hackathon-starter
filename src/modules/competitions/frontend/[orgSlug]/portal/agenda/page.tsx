'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgendaItem {
  id: string
  competition_id: string
  title: string
  description: string | null
  type: string
  starts_at: string
  ends_at: string
  location: string | null
  speaker_name: string | null
  speaker_bio: string | null
  track_id: string | null
  is_mandatory: boolean
  order: number
}

interface Competition {
  id: string
  name: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  ceremony: 'Ceremony',
  talk: 'Talk',
  workshop: 'Workshop',
  break: 'Break',
  meal: 'Meal',
  deadline: 'Deadline',
  demo_session: 'Demo Session',
  custom: 'Custom',
}

const TYPE_COLORS: Record<string, string> = {
  ceremony: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  talk: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  workshop: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  break: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  meal: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  deadline: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  demo_session: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  custom: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

function formatTimeRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
  return `${start.toLocaleTimeString(undefined, timeOpts)} - ${end.toLocaleTimeString(undefined, timeOpts)}`
}

function formatDateKey(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function getDateKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isNow(startsAt: string, endsAt: string): boolean {
  const now = Date.now()
  return new Date(startsAt).getTime() <= now && new Date(endsAt).getTime() >= now
}

function isPast(endsAt: string): boolean {
  return new Date(endsAt).getTime() < Date.now()
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PortalAgendaPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const { auth } = usePortalContext()
  const { user, loading: authLoading } = auth

  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [trackFilter, setTrackFilter] = useState<string>('')

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      const compRes = await apiCall('/api/competitions/portal/active')
      const comp: Competition | null = compRes?.data?.[0] ?? null
      if (!comp) {
        setItems([])
        return
      }

      const agendaRes = await apiCall(`/api/competitions/portal/data?type=agenda&competitionId=${comp.id}`)
      setItems(agendaRes?.data ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  // Extract unique track IDs for filter
  const trackIds = useMemo(() => {
    const ids = new Set<string>()
    for (const item of items) {
      if (item.track_id) ids.add(item.track_id)
    }
    return Array.from(ids)
  }, [items])

  // Filter by track
  const filteredItems = useMemo(() => {
    if (!trackFilter) return items
    return items.filter((item) => item.track_id === trackFilter || !item.track_id)
  }, [items, trackFilter])

  // Group by date
  const groupedItems = useMemo(() => {
    const groups: Record<string, { label: string; items: AgendaItem[] }> = {}
    for (const item of filteredItems) {
      const key = getDateKey(item.starts_at)
      if (!groups[key]) {
        groups[key] = { label: formatDateKey(item.starts_at), items: [] }
      }
      groups[key].items.push(item)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredItems])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <PortalPageHeader title={t('competitions.portal.agenda.title', 'Agenda')} />
        <PortalEmptyState
          title={t('competitions.portal.agenda.empty', 'No agenda items yet')}
          description="The agenda will be published soon."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader title={t('competitions.portal.agenda.title', 'Agenda')} />

      {/* Track filter */}
      {trackIds.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t('competitions.portal.agenda.filter_track', 'Filter by track:')}
          </span>
          <select
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
            value={trackFilter}
            onChange={(e) => setTrackFilter(e.target.value)}
          >
            <option value="">{t('competitions.portal.agenda.all_tracks', 'All tracks')}</option>
            {trackIds.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </div>
      )}

      {/* Timeline */}
      {groupedItems.map(([dateKey, group]) => (
        <div key={dateKey} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{group.label}</h2>

          <div className="relative flex flex-col gap-0">
            {/* Vertical timeline line */}
            <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

            {group.items.map((item) => {
              const current = isNow(item.starts_at, item.ends_at)
              const past = isPast(item.ends_at)

              return (
                <div key={item.id} className="relative flex gap-4 py-2 pl-8">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-1.5 top-4 size-3 rounded-full border-2 ${
                      current
                        ? 'border-primary bg-primary animate-pulse'
                        : past
                          ? 'border-muted-foreground/40 bg-muted'
                          : 'border-primary bg-background'
                    }`}
                  />

                  <PortalCard
                    className={`flex-1 ${
                      current ? 'ring-2 ring-primary/30' : ''
                    } ${
                      item.is_mandatory ? 'border-l-4 border-l-primary' : ''
                    } ${
                      past ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.title}</span>
                            {current && (
                              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                                NOW
                              </span>
                            )}
                            {item.is_mandatory && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                {t('competitions.portal.agenda.mandatory', 'Required')}
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {formatTimeRange(item.starts_at, item.ends_at)}
                          </span>
                        </div>
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${TYPE_COLORS[item.type] ?? TYPE_COLORS.custom}`}>
                          {TYPE_LABELS[item.type] ?? item.type}
                        </span>
                      </div>

                      {item.description && (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      )}

                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {item.location && (
                          <span>{item.location}</span>
                        )}
                        {item.speaker_name && (
                          <span>{item.speaker_name}</span>
                        )}
                      </div>
                    </div>
                  </PortalCard>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
