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
import { CompetitionProvider, useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { CompetitionSelector } from '../../../../../competitions/components/CompetitionSelector'

type Track = {
  id: string; name: string; description: string | null; color: string
  max_teams: number | null; sort_order: number
}

function TracksContent() {
  const t = useT()
  const { selectedId } = useCompetitionContext()

  const { data, isLoading } = useQuery({
    queryKey: ['portal-tracks', selectedId],
    queryFn: () => {
      if (!selectedId) return { items: [] as Track[], total: 0, page: 1, pageSize: 50, totalPages: 0 }
      return fetchCrudList<Track>('tracks/tracks', { pageSize: '50', sortField: 'sort_order', sortDir: 'asc', competition_id: selectedId })
    },
    enabled: !!selectedId,
  })

  if (!selectedId) {
    return <PortalEmptyState title={t('tracks.portal.noCompetition', 'Select a competition')} description={t('tracks.portal.noCompetitionDesc', 'Choose a competition to view its tracks.')} />
  }

  const tracks = data?.items ?? []

  if (isLoading) {
    return <PortalCard><div className="p-6 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div></PortalCard>
  }

  if (tracks.length === 0) {
    return <PortalEmptyState title={t('tracks.portal.empty', 'No tracks available')} description={t('tracks.portal.emptyDesc', 'Tracks will be published by the organizers soon.')} />
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {tracks.map((track) => (
        <PortalCard key={track.id}>
          <div className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: track.color }} />
              <h3 className="font-semibold">{track.name}</h3>
            </div>
            {track.description && <p className="text-sm text-muted-foreground mb-3">{track.description}</p>}
            {track.max_teams && (
              <div className="text-xs text-muted-foreground">
                {t('tracks.portal.maxTeams', 'Max teams')}: {track.max_teams}
              </div>
            )}
          </div>
        </PortalCard>
      ))}
    </div>
  )
}

export default function TracksPortalPage({ params }: { params: { orgSlug: string } }) {
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
      <PortalPageHeader title={t('tracks.portal.title', 'Tracks')} label={t('tracks.portal.label', 'Competition Categories')} />
      <TracksContent />
    </CompetitionProvider>
  )
}
