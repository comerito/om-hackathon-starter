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

type Track = {
  id: string; name: string; description: string | null; color: string
  max_teams: number | null; sort_order: number
}

export default function TracksPortalPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  const { data, isLoading } = useQuery({
    queryKey: ['portal-tracks'],
    queryFn: () => fetchCrudList<Track>('tracks/tracks', { pageSize: '50', sortField: 'sort_order', sortDir: 'asc' }),
    enabled: !!auth.user,
  })

  if (auth.loading || !auth.user) return null
  const tracks = data?.items ?? []

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader title={t('tracks.portal.title', 'Tracks')} label={t('tracks.portal.label', 'Competition Categories')} />

      {isLoading ? (
        <PortalCard><div className="p-6 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div></PortalCard>
      ) : tracks.length === 0 ? (
        <PortalEmptyState title={t('tracks.portal.empty', 'No tracks available')} description={t('tracks.portal.emptyDesc', 'Tracks will be published by the organizers soon.')} />
      ) : (
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
      )}
    </div>
  )
}
