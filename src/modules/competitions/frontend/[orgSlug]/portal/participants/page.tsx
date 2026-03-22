"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { Input } from '@open-mercato/ui/primitives/input'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { PortalCompetitionLayout } from '../../../../components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../components/CompetitionContext'

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

const roleBadgeStyles: Record<string, string> = {
  participant: 'bg-blue-100 text-blue-700',
  mentor: 'bg-purple-100 text-purple-700',
  judge: 'bg-amber-100 text-amber-700',
}

/* ---------- participants content ---------- */

function ParticipantsContent() {
  const t = useT()
  const { selectedId } = useCompetitionContext()
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

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

  if (!selectedId) {
    return (
      <PortalEmptyState
        title={t('competitions.portal.participants.noCompetition', 'Select a competition')}
        description={t('competitions.portal.participants.noCompetitionDesc', 'Choose a competition to view its participants.')}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="max-w-md">
        <Input
          placeholder={t('competitions.portal.participants.searchPlaceholder', 'Search participants by name or email...')}
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <PortalCard>
          <div className="p-6 text-sm text-muted-foreground">
            {t('common.loading', 'Loading...')}
          </div>
        </PortalCard>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {participants.map((p) => (
            <PortalCard key={p.customer_user_id}>
              <div className="p-5">
                {/* Header: Avatar + Name + Email */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {p.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm truncate">{p.display_name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                  </div>
                </div>

                {/* Role Badge + Looking for Team */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${roleBadgeStyles[p.role] ?? 'bg-gray-100 text-gray-700'}`}>
                    {p.role}
                  </span>
                  {p.looking_for_team && (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      {t('competitions.portal.participants.lookingForTeam', 'Looking for team')}
                    </span>
                  )}
                </div>

                {/* Organization */}
                {p.organization && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {p.organization}
                  </p>
                )}

                {/* Skills Tags */}
                {p.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {p.skills.slice(0, 5).map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                    {p.skills.length > 5 && (
                      <span className="text-xs text-muted-foreground">
                        +{p.skills.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </PortalCard>
          ))}
        </div>
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
      <PortalPageHeader
        title={t('competitions.portal.participants.title', 'Participants')}
        label={t('competitions.portal.participants.label', 'Directory')}
      />
      <ParticipantsContent />
    </PortalCompetitionLayout>
  )
}
