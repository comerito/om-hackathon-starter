'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Competition {
  id: string
  name: string
  stage: string
}

interface Team {
  id: string
  competition_id: string
  track_id: string | null
  name: string
  description: string | null
  status: string
  is_active: boolean
}

interface Track {
  id: string
  name: string
  color: string
}

interface LookingForTeamUser {
  id: string
  customerUserId: string
  lookingForTeam: boolean
  lookingForTeamDescription: string | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BrowseTeamsPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const { auth } = usePortalContext()
  const { user, loading: authLoading } = auth

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [tracks, setTracks] = useState<Track[]>([])
  const [lookingUsers, setLookingUsers] = useState<LookingForTeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [trackFilter, setTrackFilter] = useState<string>('')
  const [searchFilter, setSearchFilter] = useState('')
  const [activeTab, setActiveTab] = useState<'teams' | 'people'>('teams')

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      const compRes = await apiCall('/api/competitions/competitions?isActive=true&pageSize=1')
      const comp = compRes?.data?.[0] ?? null
      setCompetition(comp)

      if (!comp) {
        setTeams([])
        return
      }

      // Fetch all active teams
      const teamsRes = await apiCall(`/api/teams/teams?competitionId=${comp.id}&status=ACTIVE&pageSize=100&sortField=name&sortDir=asc`)
      setTeams(teamsRes?.data ?? [])

      // Fetch tracks
      const tracksRes = await apiCall(`/api/tracks/tracks?competitionId=${comp.id}&pageSize=100&sortField=order&sortDir=asc`)
      setTracks(tracksRes?.data ?? [])

      // Fetch people looking for teams
      const participantsRes = await apiCall(`/api/competitions/participations?competitionId=${comp.id}&pageSize=100`)
      const looking = ((participantsRes?.data ?? []) as LookingForTeamUser[]).filter((p) => p.lookingForTeam)
      setLookingUsers(looking)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  const handleJoinRequest = async (teamId: string) => {
    if (!competition || !user) return
    setActionLoading(teamId)
    try {
      await apiCall('/api/teams/invitations', {
        method: 'POST',
        body: JSON.stringify({
          teamId,
          inviteeId: user.id,
          type: 'JOIN_REQUEST',
          competitionId: competition.id,
        }),
      })
      alert(t('teams.portal.browse.joinRequestSent', 'Join request sent!'))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send join request')
    } finally {
      setActionLoading(null)
    }
  }

  const filteredTeams = useMemo(() => {
    let result = teams
    if (trackFilter) {
      result = result.filter((team) => team.track_id === trackFilter)
    }
    if (searchFilter) {
      const lower = searchFilter.toLowerCase()
      result = result.filter(
        (team) =>
          team.name.toLowerCase().includes(lower) ||
          (team.description ?? '').toLowerCase().includes(lower),
      )
    }
    return result
  }, [teams, trackFilter, searchFilter])

  const trackMap = useMemo(() => {
    const map: Record<string, Track> = {}
    tracks.forEach((tr) => { map[tr.id] = tr })
    return map
  }, [tracks])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (!competition) {
    return (
      <div className="flex flex-col gap-8">
        <PortalPageHeader title={t('teams.portal.browse.title', 'Browse Teams')} />
        <PortalEmptyState
          title={t('teams.portal.browse.noCompetition', 'No active competition')}
          description={t('teams.portal.browse.noCompetitionDesc', 'There is no active competition at this time.')}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader title={t('teams.portal.browse.title', 'Browse Teams')} />

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setActiveTab('teams')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'teams' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('teams.portal.browse.teamsTab', 'Teams')} ({filteredTeams.length})
        </button>
        <button
          onClick={() => setActiveTab('people')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'people' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('teams.portal.browse.peopleTab', 'Looking for Team')} ({lookingUsers.length})
        </button>
      </div>

      {activeTab === 'teams' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder={t('teams.portal.browse.searchPlaceholder', 'Search teams...')}
              className="rounded-md border px-3 py-1.5 text-sm flex-1 min-w-[200px]"
            />
            {tracks.length > 0 && (
              <select
                value={trackFilter}
                onChange={(e) => setTrackFilter(e.target.value)}
                className="rounded-md border px-3 py-1.5 text-sm"
              >
                <option value="">{t('teams.portal.browse.allTracks', 'All tracks')}</option>
                {tracks.map((track) => (
                  <option key={track.id} value={track.id}>{track.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Team cards */}
          {filteredTeams.length === 0 ? (
            <PortalEmptyState
              title={t('teams.portal.browse.noTeams', 'No teams found')}
              description={t('teams.portal.browse.noTeamsDesc', 'Try adjusting your filters.')}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTeams.map((team) => {
                const track = team.track_id ? trackMap[team.track_id] : null
                return (
                  <PortalCard key={team.id} className="relative overflow-hidden">
                    {/* Track color accent */}
                    {track && (
                      <div
                        className="absolute inset-x-0 top-0 h-1"
                        style={{ backgroundColor: track.color }}
                      />
                    )}

                    <div className="flex flex-col gap-3 pt-1">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm">{team.name}</h3>
                          {track && (
                            <span className="text-xs text-muted-foreground">{track.name}</span>
                          )}
                        </div>
                      </div>

                      {team.description && (
                        <p className="text-xs text-muted-foreground line-clamp-3">{team.description}</p>
                      )}

                      <div className="flex items-center justify-between border-t pt-3 mt-auto">
                        <span className="text-xs text-muted-foreground">
                          {track ? track.name : t('teams.portal.browse.noTrack', 'No track')}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleJoinRequest(team.id)}
                          disabled={actionLoading === team.id}
                        >
                          {actionLoading === team.id
                            ? t('teams.portal.browse.sending', 'Sending...')
                            : t('teams.portal.browse.requestJoin', 'Request to Join')}
                        </Button>
                      </div>
                    </div>
                  </PortalCard>
                )
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'people' && (
        <>
          {lookingUsers.length === 0 ? (
            <PortalEmptyState
              title={t('teams.portal.browse.noPeople', 'No one looking for a team')}
              description={t('teams.portal.browse.noPeopleDesc', 'Check back later as more participants register.')}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lookingUsers.map((person) => (
                <PortalCard key={person.id}>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                        <svg className="size-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{person.customerUserId.slice(0, 8)}...</p>
                        <p className="text-xs text-muted-foreground">{t('teams.portal.browse.lookingForTeam', 'Looking for team')}</p>
                      </div>
                    </div>
                    {person.lookingForTeamDescription && (
                      <p className="text-xs text-muted-foreground">{person.lookingForTeamDescription}</p>
                    )}
                  </div>
                </PortalCard>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
