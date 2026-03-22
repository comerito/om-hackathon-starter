"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { Input } from '@open-mercato/ui/primitives/input'
import { CompetitionProvider, useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { CompetitionSelector } from '../../../../../competitions/components/CompetitionSelector'

type Team = {
  id: string; name: string; description: string | null; status: string
  track_id: string | null; _teams?: { memberCount: number }
}

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  disqualified: 'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-500',
}

function TeamsContent() {
  const t = useT()
  const { selectedId } = useCompetitionContext()
  const [search, setSearch] = React.useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['portal-teams', selectedId, search],
    queryFn: () => {
      if (!selectedId) return { items: [] as Team[], total: 0, page: 1, pageSize: 50, totalPages: 0 }
      const params: Record<string, string> = { pageSize: '50', sortField: 'name', sortDir: 'asc', competition_id: selectedId }
      if (search) params.name = search
      return fetchCrudList<Team>('teams/teams', params)
    },
    enabled: !!selectedId,
  })

  if (!selectedId) {
    return <PortalEmptyState title={t('teams.portal.browse.noCompetition', 'Select a competition')} description={t('teams.portal.browse.noCompetitionDesc', 'Choose a competition to browse teams.')} />
  }

  const teams = data?.items ?? []

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <Input
          type="text"
          placeholder={t('teams.portal.browse.search', 'Search teams...')}
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {isLoading ? (
        <PortalCard><div className="p-6 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div></PortalCard>
      ) : teams.length === 0 ? (
        <PortalEmptyState
          title={t('teams.portal.browse.empty', 'No teams found')}
          description={search
            ? t('teams.portal.browse.emptySearch', 'Try a different search term.')
            : t('teams.portal.browse.emptyAll', 'No teams have been created yet.')}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <PortalCard key={team.id}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{team.name}</h3>
                  <span className={`text-xs rounded px-1.5 py-0.5 capitalize ${statusStyles[team.status] ?? 'bg-muted'}`}>
                    {team.status}
                  </span>
                </div>
                {team.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{team.description}</p>}
                <div className="text-xs text-muted-foreground">
                  {team._teams?.memberCount ?? '?'} {t('teams.portal.browse.members', 'members')}
                </div>
              </div>
            </PortalCard>
          ))}
        </div>
      )}
    </>
  )
}

export default function TeamBrowserPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <CompetitionProvider>
      <CompetitionSelector />
      <PortalPageHeader title={t('teams.portal.browse.title', 'Browse Teams')} label={t('teams.portal.browse.label', 'Find a Team')} />
      <TeamsContent />
    </CompetitionProvider>
  )
}
