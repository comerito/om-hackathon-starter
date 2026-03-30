"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { PortalCompetitionLayout } from '../../../../../competitions/components/PortalCompetitionLayout'
import { PortalPageTitle } from '@/components/portal'

type Track = { id: string; name: string; description: string | null; color: string }
type Team = { id: string; name: string; status: string; track_id: string | null; _teams?: { memberCount: number } }

export default function MentorTracksPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  const { data: tracksData, isLoading: tracksLoading } = useQuery({
    queryKey: ['portal-mentor-tracks'],
    queryFn: () => fetchCrudList<Track>('tracks/tracks', { pageSize: '50', sortField: 'sort_order', sortDir: 'asc' }),
    enabled: !!auth.user,
  })

  const { data: teamsData, isLoading: teamsLoading } = useQuery({
    queryKey: ['portal-mentor-teams'],
    queryFn: () => fetchCrudList<Team>('teams/teams', { pageSize: '100', sortField: 'name', sortDir: 'asc' }),
    enabled: !!auth.user,
  })

  if (auth.loading || !auth.user) return null

  const tracks = tracksData?.items ?? []
  const teams = teamsData?.items ?? []
  const isLoading = tracksLoading || teamsLoading

  const teamsByTrack = React.useMemo(() => {
    const map = new Map<string, Team[]>()
    for (const team of teams) {
      if (team.track_id) {
        const list = map.get(team.track_id) ?? []
        list.push(team)
        map.set(team.track_id, list)
      }
    }
    return map
  }, [teams])

  return (
    <PortalCompetitionLayout>
      <PortalPageTitle label={t('tracks.portal.mentor.label', 'Your Tracks')} title={t('tracks.portal.mentor.title', 'Mentor Dashboard')} />

      {isLoading ? (
        <PortalCard><div className="p-6 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div></PortalCard>
      ) : tracks.length === 0 ? (
        <PortalEmptyState title={t('tracks.portal.mentor.empty', 'No tracks assigned')} description={t('tracks.portal.mentor.emptyDesc', 'Track assignments will be configured by the organizer.')} />
      ) : (
        <div className="space-y-6">
          {tracks.map((track) => {
            const trackTeams = teamsByTrack.get(track.id) ?? []
            return (
              <PortalCard key={track.id}>
                <PortalCardHeader title={track.name} />
                <div className="px-6 pb-6">
                  {track.description && <p className="text-sm text-muted-foreground mb-4">{track.description}</p>}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: track.color }} />
                    <span className="text-sm font-medium">{trackTeams.length} {t('tracks.portal.mentor.teams', 'teams')}</span>
                  </div>
                  {trackTeams.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('tracks.portal.mentor.noTeams', 'No teams in this track yet.')}</p>
                  ) : (
                    <div className="divide-y">
                      {trackTeams.map((team) => (
                        <div key={team.id} className="py-2 flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium">{team.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {t('tracks.portal.mentor.members', '{count} members', { count: team._teams?.memberCount ?? '?' })}
                            </span>
                          </div>
                          <span className={`text-xs rounded px-1.5 py-0.5 capitalize ${team.status === 'active' ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-slate-400'}`}>
                            {t(`tracks.portal.mentor.status.${team.status}`, team.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </PortalCard>
            )
          })}
        </div>
      )}
    </PortalCompetitionLayout>
  )
}
