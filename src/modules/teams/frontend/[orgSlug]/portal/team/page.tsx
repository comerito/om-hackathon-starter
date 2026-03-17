'use client'

import { useEffect, useState, useCallback } from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader, PortalStatRow, PortalCardDivider } from '@open-mercato/ui/portal/components'
import { PortalEmptyState } from '@open-mercato/ui/portal/components'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { usePortalAppEvent } from '@open-mercato/ui/portal/hooks/usePortalAppEvent'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Competition {
  id: string
  name: string
  stage: string
  maxTeamSize: number
  minTeamSize: number
  allowTrackChange: boolean
}

interface Team {
  id: string
  competition_id: string
  track_id: string | null
  name: string
  description: string | null
  status: string
  is_finalist: boolean
  table_number: number | null
  table_location: string | null
}

interface TeamMember {
  id: string
  teamId: string
  customerUserId: string
  role: string
  joinedAt: string
}

interface Invitation {
  id: string
  teamId: string
  inviterId: string
  inviteeId: string
  type: string
  status: string
  message: string | null
  createdAt: string
  expiresAt: string
}

interface Track {
  id: string
  name: string
  description: string | null
  color: string
  max_teams: number | null
  is_active?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PortalMyTeamPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const { auth } = usePortalContext()
  const { user, loading: authLoading } = auth

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [createMode, setCreateMode] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamDesc, setTeamDesc] = useState('')

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      // Fetch active competition
      const compRes = await apiCall('/api/competitions/competitions?isActive=true&pageSize=1')
      const comp = compRes?.data?.[0] ?? null
      setCompetition(comp)

      if (!comp) {
        setTeam(null)
        return
      }

      // Find user's team membership by checking team members
      // First, find teams in this competition that the user belongs to
      const teamsRes = await apiCall(`/api/teams/teams?competitionId=${comp.id}&pageSize=100`)
      const allTeams: Team[] = teamsRes?.data ?? []

      // Find the team the user is on by checking invitations with accepted status
      // or by direct member lookup
      let userTeam: Team | null = null

      // Try to find team through invitations
      const invRes = await apiCall(`/api/teams/invitations?inviteeId=${user.id}&competitionId=${comp.id}&status=ACCEPTED&pageSize=1`)
      const acceptedInv = invRes?.data?.[0]
      if (acceptedInv) {
        userTeam = allTeams.find((t: Team) => t.id === acceptedInv.teamId) ?? null
      }

      // Also check if user created a team (will be in the teams list)
      if (!userTeam) {
        // Fall back to checking all teams — in a real implementation we'd have a
        // /api/teams/my-team endpoint, but for now we iterate
        for (const candidate of allTeams) {
          const memberCheck = await apiCall(`/api/teams/invitations?teamId=${candidate.id}&inviteeId=${user.id}&status=ACCEPTED&pageSize=1`)
          if (memberCheck?.data?.length > 0) {
            userTeam = candidate
            break
          }
        }
      }

      setTeam(userTeam)

      if (userTeam) {
        // Fetch team invitations
        const teamInvRes = await apiCall(`/api/teams/invitations?teamId=${userTeam.id}&pageSize=50`)
        setInvitations(teamInvRes?.data ?? [])
      }

      // Fetch pending invitations for the user
      const pendingInvRes = await apiCall(`/api/teams/invitations?inviteeId=${user.id}&competitionId=${comp.id}&status=PENDING&pageSize=50`)
      if (!userTeam) {
        setInvitations(pendingInvRes?.data ?? [])
      }

      // Fetch tracks
      const tracksRes = await apiCall(`/api/tracks/tracks?competitionId=${comp.id}&pageSize=100&sortField=order&sortDir=asc`)
      setTracks((tracksRes?.data ?? []).filter((tr: Track) => tr.is_active !== false))
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  usePortalAppEvent('teams.team.updated', () => { fetchData() })
  usePortalAppEvent('teams.team.track_selected', () => { fetchData() })
  usePortalAppEvent('teams.member.joined', () => { fetchData() })
  usePortalAppEvent('teams.member.left', () => { fetchData() })
  usePortalAppEvent('teams.invitation.accepted', () => { fetchData() })

  const handleCreateTeam = async () => {
    if (!competition || !teamName.trim()) return
    setActionLoading(true)
    try {
      const res = await apiCall('/api/teams/teams', {
        method: 'POST',
        body: JSON.stringify({
          competitionId: competition.id,
          name: teamName.trim(),
          description: teamDesc.trim() || null,
        }),
      })

      // After creating team, user needs to be added as owner
      // This should be handled by the backend, but for now we'll refetch
      setCreateMode(false)
      setTeamName('')
      setTeamDesc('')
      await fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create team')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAcceptInvitation = async (invitationId: string) => {
    setActionLoading(true)
    try {
      await apiCall('/api/teams/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ invitationId }),
      })
      await fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to accept invitation')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeclineInvitation = async (invitationId: string) => {
    setActionLoading(true)
    try {
      await apiCall('/api/teams/invitations/decline', {
        method: 'POST',
        body: JSON.stringify({ invitationId }),
      })
      await fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to decline invitation')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSelectTrack = async (trackId: string) => {
    if (!team) return
    setActionLoading(true)
    try {
      await apiCall('/api/teams/teams/select-track', {
        method: 'POST',
        body: JSON.stringify({ teamId: team.id, trackId }),
      })
      await fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to select track')
    } finally {
      setActionLoading(false)
    }
  }

  const handleLeaveTeam = async () => {
    if (!team || !competition) return
    if (!window.confirm(t('teams.portal.team.confirmLeave', 'Are you sure you want to leave this team?'))) return
    setActionLoading(true)
    try {
      await apiCall('/api/teams/members/leave', {
        method: 'POST',
        body: JSON.stringify({ teamId: team.id, competitionId: competition.id }),
      })
      await fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to leave team')
    } finally {
      setActionLoading(false)
    }
  }

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
        <PortalPageHeader title={t('teams.portal.team.title', 'My Team')} />
        <PortalEmptyState
          title={t('teams.portal.team.noCompetition', 'No active competition')}
          description={t('teams.portal.team.noCompetitionDesc', 'There is no active competition at this time.')}
        />
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // No team yet — show options
  // ---------------------------------------------------------------------------

  if (!team) {
    const pendingInvitations = invitations.filter((inv) => inv.status === 'PENDING' && inv.type === 'INVITE')

    return (
      <div className="flex flex-col gap-6">
        <PortalPageHeader title={t('teams.portal.team.title', 'My Team')} />

        {/* Pending invitations */}
        {pendingInvitations.length > 0 && (
          <PortalCard>
            <PortalCardHeader
              label={t('teams.portal.team.pendingInvitations', 'Pending Invitations')}
              title={t('teams.portal.team.youveBeenInvited', "You've been invited!")}
            />
            <div className="mt-3 space-y-3">
              {pendingInvitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Team invitation</p>
                    {inv.message && <p className="text-xs text-muted-foreground mt-0.5">{inv.message}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAcceptInvitation(inv.id)}
                      disabled={actionLoading}
                    >
                      {t('teams.portal.team.accept', 'Accept')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeclineInvitation(inv.id)}
                      disabled={actionLoading}
                    >
                      {t('teams.portal.team.decline', 'Decline')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </PortalCard>
        )}

        {/* Create team form */}
        {createMode ? (
          <PortalCard>
            <PortalCardHeader
              label={t('teams.portal.team.createTeam', 'Create a Team')}
              title={t('teams.portal.team.createTeamDesc', 'Start your own team')}
            />
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t('teams.portal.team.nameLabel', 'Team name')}</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder={t('teams.portal.team.namePlaceholder', 'e.g. The Innovators')}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  maxLength={255}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('teams.portal.team.descLabel', 'Description (optional)')}</label>
                <textarea
                  value={teamDesc}
                  onChange={(e) => setTeamDesc(e.target.value)}
                  placeholder={t('teams.portal.team.descPlaceholder', 'What is your team about?')}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  rows={3}
                  maxLength={5000}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateTeam} disabled={!teamName.trim() || actionLoading}>
                  {t('teams.portal.team.createButton', 'Create Team')}
                </Button>
                <Button variant="outline" onClick={() => setCreateMode(false)}>
                  {t('teams.portal.team.cancel', 'Cancel')}
                </Button>
              </div>
            </div>
          </PortalCard>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <PortalCard
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setCreateMode(true)}
            >
              <div className="flex flex-col items-center text-center py-4">
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <svg className="size-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="font-semibold text-sm">{t('teams.portal.team.createTeam', 'Create a Team')}</h3>
                <p className="text-xs text-muted-foreground mt-1">{t('teams.portal.team.createTeamHint', 'Start your own team and invite others')}</p>
              </div>
            </PortalCard>

            <Link href={`/${params.orgSlug}/portal/teams/browse`}>
              <PortalCard className="cursor-pointer hover:border-primary/50 transition-colors h-full">
                <div className="flex flex-col items-center text-center py-4">
                  <div className="size-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                    <svg className="size-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-sm">{t('teams.portal.team.browseTeams', 'Browse Teams')}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{t('teams.portal.team.browseTeamsHint', 'Find a team looking for members')}</p>
                </div>
              </PortalCard>
            </Link>

            <PortalCard className="border-dashed">
              <div className="flex flex-col items-center text-center py-4">
                <div className="size-12 rounded-full bg-orange-50 flex items-center justify-center mb-3">
                  <svg className="size-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-sm">{t('teams.portal.team.lookingForTeam', 'Looking for Team')}</h3>
                <p className="text-xs text-muted-foreground mt-1">{t('teams.portal.team.lookingForTeamHint', 'Mark yourself as available')}</p>
              </div>
            </PortalCard>
          </div>
        )}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Has team — show team dashboard
  // ---------------------------------------------------------------------------

  const stageAllowsTrackSelection = competition.stage === 'TRACK_SELECTION' || (competition.allowTrackChange && ['TEAM_FORMATION', 'HACKING'].includes(competition.stage))

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader
        label={t('teams.portal.team.label', 'Your Team')}
        title={team.name}
      />

      {/* Status card */}
      <PortalCard className={team.status === 'DISQUALIFIED' ? 'border-red-200 bg-red-50' : ''}>
        <div className="flex items-center justify-between">
          <div>
            <PortalCardHeader
              label={t('teams.portal.team.statusLabel', 'Status')}
              title={team.status}
            />
            {team.is_finalist && (
              <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-800 px-2 py-0.5 text-xs font-medium mt-1">
                Finalist
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLeaveTeam}
            disabled={actionLoading}
          >
            {t('teams.portal.team.leaveTeam', 'Leave Team')}
          </Button>
        </div>
      </PortalCard>

      {/* Table assignment */}
      {(team.table_number != null || team.table_location) && (
        <PortalCard className="border-primary/20 bg-primary/5">
          <PortalCardHeader
            label={t('teams.portal.team.tableAssignment', 'Table Assignment')}
            title={team.table_number ? `Table #${team.table_number}` : 'Assigned'}
          />
          {team.table_location && (
            <p className="text-sm text-muted-foreground mt-1">{team.table_location}</p>
          )}
        </PortalCard>
      )}

      {/* Track selection */}
      {stageAllowsTrackSelection && (
        <PortalCard>
          <PortalCardHeader
            label={t('teams.portal.team.track', 'Track')}
            title={team.track_id ? t('teams.portal.team.trackSelected', 'Track Selected') : t('teams.portal.team.selectTrack', 'Select a Track')}
          />
          {tracks.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {tracks.map((track) => (
                <button
                  key={track.id}
                  onClick={() => handleSelectTrack(track.id)}
                  disabled={actionLoading || team.track_id === track.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors
                    ${team.track_id === track.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}
                    disabled:opacity-50`}
                >
                  <div
                    className="size-8 rounded-md flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: track.color }}
                  >
                    {track.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{track.name}</div>
                    {track.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{track.description}</p>
                    )}
                    {track.max_teams != null && (
                      <p className="text-[10px] text-muted-foreground mt-1">Max {track.max_teams} teams</p>
                    )}
                  </div>
                  {team.track_id === track.id && (
                    <span className="text-xs text-primary font-medium shrink-0">Selected</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </PortalCard>
      )}

      {/* Show selected track when not in selection mode */}
      {!stageAllowsTrackSelection && team.track_id && (
        <PortalCard>
          <PortalCardHeader
            label={t('teams.portal.team.track', 'Track')}
            title={tracks.find((tr) => tr.id === team.track_id)?.name ?? team.track_id.slice(0, 8)}
          />
        </PortalCard>
      )}

      {/* Invitations management */}
      {invitations.length > 0 && (
        <PortalCard>
          <PortalCardHeader
            label={t('teams.portal.team.invitations', 'Invitations')}
            title={`${invitations.filter((i) => i.status === 'PENDING').length} pending`}
          />
          <div className="mt-3 space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <div>
                  <span className="font-medium text-xs">{inv.type === 'JOIN_REQUEST' ? 'Join Request' : 'Invitation'}</span>
                  <span className="text-muted-foreground text-xs ml-2">{inv.inviteeId.slice(0, 8)}...</span>
                  <span className={`ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    inv.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    inv.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {inv.status}
                  </span>
                </div>
                {inv.status === 'PENDING' && inv.type === 'JOIN_REQUEST' && (
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => handleAcceptInvitation(inv.id)} disabled={actionLoading}>
                      Accept
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDeclineInvitation(inv.id)} disabled={actionLoading}>
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </PortalCard>
      )}

      {/* Team description */}
      {team.description && (
        <PortalCard>
          <PortalCardHeader
            label={t('teams.portal.team.about', 'About')}
            title={t('teams.portal.team.teamDescription', 'Team Description')}
          />
          <p className="text-sm text-muted-foreground mt-2">{team.description}</p>
        </PortalCard>
      )}
    </div>
  )
}
