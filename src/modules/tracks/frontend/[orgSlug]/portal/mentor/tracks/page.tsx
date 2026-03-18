'use client'

import { useEffect, useState, useCallback } from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Track {
  id: string
  competition_id: string
  name: string
  description: string | null
  color: string
  icon_url: string | null
  max_teams: number | null
  order: number
  mentor_ids: string[]
  is_active: boolean
}

interface Competition {
  id: string
  name: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MentorTracksPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const { auth } = usePortalContext()
  const { user, loading: authLoading } = auth

  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      // Get the active competition
      const compRes = await apiCall('/api/competitions/competitions?isActive=true&pageSize=1')
      const comp: Competition | null = compRes?.data?.[0] ?? null
      if (!comp) {
        setTracks([])
        return
      }

      // Fetch all tracks and filter client-side for those containing current user as mentor
      const tracksRes = await apiCall(`/api/tracks/tracks?competitionId=${comp.id}&pageSize=100&sortField=order&sortDir=asc`)
      const allTracks: Track[] = tracksRes?.data ?? []
      const userId = (user as { id?: string })?.id
      const myTracks = allTracks.filter(
        (track) => userId && Array.isArray(track.mentor_ids) && track.mentor_ids.includes(userId),
      )
      setTracks(myTracks)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <PortalPageHeader title={t('tracks.mentor.title', 'My Tracks')} />
        <PortalEmptyState
          title={t('tracks.mentor.empty', 'No assigned tracks')}
          description={t('tracks.mentor.empty.description', 'You are not assigned as a mentor to any track yet.')}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader title={t('tracks.mentor.title', 'My Tracks')} />

      <div className="flex flex-col gap-4">
        {tracks.map((track) => (
          <PortalCard
            key={track.id}
            className="relative overflow-hidden"
          >
            {/* Color accent bar */}
            <div
              className="absolute inset-y-0 left-0 w-1.5"
              style={{ backgroundColor: track.color }}
            />

            <div className="flex flex-col gap-4 pl-4">
              {/* Track header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-10 items-center justify-center rounded-lg text-white font-bold text-lg shrink-0"
                    style={{ backgroundColor: track.color }}
                  >
                    {track.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">{track.name}</h3>
                    {track.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                        {track.description}
                      </p>
                    )}
                  </div>
                </div>
                {track.max_teams != null && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {t('tracks.mentor.maxTeams', 'Max {{count}} teams', { count: String(track.max_teams) })}
                  </span>
                )}
              </div>

              {/* Team list placeholder */}
              <div className="border-t pt-3">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {t('tracks.mentor.teams', 'Teams')}
                </h4>
                <p className="text-sm text-muted-foreground italic">
                  {t('tracks.mentor.teams.placeholder', 'Team list will be available once the teams module is implemented.')}
                </p>
              </div>
            </div>
          </PortalCard>
        ))}
      </div>
    </div>
  )
}
