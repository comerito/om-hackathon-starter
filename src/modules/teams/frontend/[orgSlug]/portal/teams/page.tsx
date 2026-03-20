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

type Team = {
  id: string; name: string; description: string | null; status: string
  track_id: string | null; created_at: string
  _teams?: { memberCount: number }
}

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  disqualified: 'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-500',
}

export default function TeamBrowserPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()
  const [search, setSearch] = React.useState('')

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  const { data, isLoading } = useQuery({
    queryKey: ['portal-teams', search],
    queryFn: () => {
      const params: Record<string, string> = { pageSize: '50', sortField: 'name', sortDir: 'asc' }
      if (search) params.name = search
      return fetchCrudList<Team>('teams/teams', params)
    },
    enabled: !!auth.user,
  })

  if (auth.loading || !auth.user) return null
  const teams = data?.items ?? []

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader title={t('teams.portal.browse.title', 'Browse Teams')} label={t('teams.portal.browse.label', 'Find a Team')} />

      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder={t('teams.portal.browse.search', 'Search teams...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex h-9 w-full max-w-sm rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {isLoading ? (
        <PortalCard><div className="p-6 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div></PortalCard>
      ) : teams.length === 0 ? (
        <PortalEmptyState
          title={t('teams.portal.browse.empty', 'No teams found')}
          description={search
            ? t('teams.portal.browse.emptySearch', 'Try a different search term.')
            : t('teams.portal.browse.emptyAll', 'No teams have been created yet. Be the first to start one!')}
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
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{team._teams?.memberCount ?? '?'} {t('teams.portal.browse.members', 'members')}</span>
                </div>
              </div>
            </PortalCard>
          ))}
        </div>
      )}
    </div>
  )
}
