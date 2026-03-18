'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
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

export default function PortalTracksPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const { auth } = usePortalContext()
  const { user, loading: authLoading } = auth

  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      const compRes = await apiCall('/api/competitions/portal/active')
      const comp: Competition | null = compRes?.data?.[0] ?? null
      if (!comp) {
        setTracks([])
        return
      }

      const tracksRes = await apiCall(`/api/competitions/portal/data?type=tracks&competitionId=${comp.id}`)
      setTracks((tracksRes?.data ?? []).filter((t: Track) => t.is_active))
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
        <PortalPageHeader title={t('tracks.portal.title', 'Tracks')} />
        <PortalEmptyState
          title={t('tracks.portal.empty', 'No tracks yet')}
          description={t('tracks.portal.empty.description', 'Tracks will be announced soon.')}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader title={t('tracks.portal.title', 'Tracks')} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tracks.map((track) => (
          <PortalCard
            key={track.id}
            className="relative overflow-hidden"
          >
            {/* Color accent bar */}
            <div
              className="absolute inset-x-0 top-0 h-1.5"
              style={{ backgroundColor: track.color }}
            />

            <div className="flex flex-col gap-3 pt-3">
              {/* Header with icon */}
              <div className="flex items-start gap-3">
                {track.icon_url ? (
                  <img
                    src={track.icon_url}
                    alt=""
                    className="size-10 rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className="flex size-10 items-center justify-center rounded-lg text-white font-bold text-lg"
                    style={{ backgroundColor: track.color }}
                  >
                    {track.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base">{track.name}</h3>
                  {track.max_teams != null && (
                    <span className="text-xs text-muted-foreground">
                      {t('tracks.portal.maxTeams', 'Max {{count}} teams', { count: String(track.max_teams) })}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              {track.description && (
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {track.description}
                </p>
              )}

              {/* Footer stats */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3 mt-auto">
                <span>
                  {t('tracks.portal.teams', '0 teams')}
                </span>
                {track.mentor_ids.length > 0 && (
                  <span>
                    {t('tracks.portal.mentors', '{{count}} mentors', { count: String(track.mentor_ids.length) })}
                  </span>
                )}
              </div>
            </div>
          </PortalCard>
        ))}
      </div>
    </div>
  )
}
