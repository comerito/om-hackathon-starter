"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalCardHeader } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { CompetitionProvider, useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { CompetitionSelector } from '../../../../../competitions/components/CompetitionSelector'
import Link from 'next/link'

/* ---------- types ---------- */

type Team = {
  id: string
  name: string
  description: string | null
  status: string
  track_id: string | null
  competition_id: string
  _teams?: { memberCount: number }
}

type TeamMember = {
  id: string
  team_id: string
  customer_user_id: string
  competition_id: string
  role: string
  joined_at: string
}

type Invitation = {
  id: string
  team_id: string
  inviter_id: string
  invitee_id: string
  type: string
  status: string
  message: string | null
  created_at: string
  team_name?: string
}

type Track = {
  id: string
  name: string
  description: string | null
}

/* ========== NoTeamView ========== */

function NoTeamView({
  orgSlug,
  competitionId,
  userId,
}: {
  orgSlug: string
  competitionId: string
  userId: string
}) {
  const t = useT()
  const queryClient = useQueryClient()

  // Create team form state
  const [showCreateForm, setShowCreateForm] = React.useState(false)
  const [teamName, setTeamName] = React.useState('')
  const [teamDesc, setTeamDesc] = React.useState('')
  const [creating, setCreating] = React.useState(false)

  // Looking for team state
  const [lookingForTeam, setLookingForTeam] = React.useState(false)
  const [lookingDescription, setLookingDescription] = React.useState('')
  const [updatingLooking, setUpdatingLooking] = React.useState(false)

  // Invitations received (type = 'invitation', invitee is me)
  const { data: invData } = useQuery({
    queryKey: ['portal-invitations', competitionId],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ received: Invitation[]; team_requests: Invitation[] }>(
        `/api/teams/portal/my-invitations?competition_id=${competitionId}`,
      )
      if (ok && result) return result
      return { received: [] as Invitation[], team_requests: [] as Invitation[] }
    },
    enabled: !!competitionId,
  })

  const receivedInvitations = invData?.received ?? []

  async function handleCreateTeam() {
    if (!teamName.trim()) return
    setCreating(true)
    try {
      const { ok, result } = await apiCall<{ id: string; error?: string }>('/api/teams/portal/create-team', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          competition_id: competitionId,
          name: teamName.trim(),
          description: teamDesc.trim() || undefined,
        }),
      })
      if (ok) {
        flash(t('teams.portal.myTeam.created', 'Team created!'), 'success')
        queryClient.invalidateQueries({ queryKey: ['portal-my-membership'] })
      } else {
        flash(result?.error ?? t('teams.portal.myTeam.createFailed', 'Failed to create team'), 'error')
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleToggleLooking(checked: boolean) {
    setLookingForTeam(checked)
    setUpdatingLooking(true)
    try {
      await apiCall('/api/competitions/portal/update-participation', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          competition_id: competitionId,
          looking_for_team: checked,
          looking_for_team_description: lookingDescription.trim() || null,
        }),
      })
    } finally {
      setUpdatingLooking(false)
    }
  }

  async function handleSaveLookingDescription() {
    setUpdatingLooking(true)
    try {
      await apiCall('/api/competitions/portal/update-participation', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          competition_id: competitionId,
          looking_for_team: lookingForTeam,
          looking_for_team_description: lookingDescription.trim() || null,
        }),
      })
      flash(t('teams.portal.myTeam.lookingSaved', 'Profile updated'), 'success')
    } finally {
      setUpdatingLooking(false)
    }
  }

  async function handleRespondInvitation(invitationId: string, action: 'accept' | 'decline') {
    const { ok } = await apiCall('/api/teams/portal/respond-invitation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invitation_id: invitationId, action }),
    })
    if (ok) {
      flash(
        action === 'accept'
          ? t('teams.portal.myTeam.invAccepted', 'Invitation accepted!')
          : t('teams.portal.myTeam.invDeclined', 'Invitation declined'),
        'success',
      )
      queryClient.invalidateQueries({ queryKey: ['portal-invitations'] })
      queryClient.invalidateQueries({ queryKey: ['portal-my-membership'] })
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Action Tiles ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Tile 1: Create Team */}
        <div className="group relative rounded-xl border bg-gradient-to-br from-background to-muted/30 p-6 transition-all hover:shadow-md hover:border-primary/30">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" />
            </svg>
          </div>
          <h3 className="font-semibold mb-1">{t('teams.portal.myTeam.createTeam', 'Create a Team')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('teams.portal.myTeam.noTeamDesc', 'Start your own team and invite others to join.')}
          </p>
          <Button onClick={() => setShowCreateForm(true)} size="sm" className="w-full">
            {t('teams.portal.myTeam.createTeamBtn', 'Create Team')}
          </Button>
        </div>

        {/* Tile 2: Browse Teams */}
        <div className="group relative rounded-xl border bg-gradient-to-br from-background to-muted/30 p-6 transition-all hover:shadow-md hover:border-primary/30">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <h3 className="font-semibold mb-1">{t('teams.portal.myTeam.browseTeams', 'Browse Teams')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('teams.portal.myTeam.browseTeamsDesc', 'Find an existing team to join or see who is looking for teammates.')}
          </p>
          <Button variant="outline" size="sm" asChild className="w-full">
            <Link href={`/${orgSlug}/portal/teams`}>
              {t('teams.portal.myTeam.browseBtn', 'Browse')}
            </Link>
          </Button>
        </div>

        {/* Tile 3: Looking for Team */}
        <div className="group relative rounded-xl border bg-gradient-to-br from-background to-muted/30 p-6 transition-all hover:shadow-md hover:border-primary/30">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="font-semibold mb-1">{t('teams.portal.myTeam.lookingForTeam', 'Looking for a Team')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('teams.portal.myTeam.lookingForTeamDesc', 'Let others know you are available to join a team.')}
          </p>
          <label className="flex items-center gap-2.5 cursor-pointer rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/50">
            <input
              type="checkbox"
              checked={lookingForTeam}
              onChange={(e) => handleToggleLooking(e.target.checked)}
              disabled={updatingLooking}
              className="h-4 w-4 rounded border-gray-300 accent-primary"
            />
            <span>{t('teams.portal.myTeam.markLooking', 'Mark me as looking')}</span>
          </label>
        </div>
      </div>

      {/* ── Create Team Expanded Form ── */}
      {showCreateForm && (
        <PortalCard>
          <PortalCardHeader title={t('teams.portal.myTeam.createTeamForm', 'New Team')} />
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                {t('teams.portal.myTeam.teamName', 'Team Name')} <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                value={teamName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTeamName(e.target.value)}
                placeholder={t('teams.portal.myTeam.teamNamePlaceholder', 'Enter team name...')}
                className="max-w-md"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                {t('teams.portal.myTeam.teamDescription', 'Description')}
              </label>
              <textarea
                value={teamDesc}
                onChange={(e) => setTeamDesc(e.target.value)}
                placeholder={t('teams.portal.myTeam.teamDescPlaceholder', 'Describe your team idea or project...')}
                className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateTeam} disabled={!teamName.trim() || creating}>
                {creating ? t('common.saving', 'Saving...') : t('teams.portal.myTeam.createTeamSubmit', 'Create Team')}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
            </div>
          </div>
        </PortalCard>
      )}

      {/* ── Looking for Team Description (expanded) ── */}
      {lookingForTeam && (
        <PortalCard>
          <PortalCardHeader title={t('teams.portal.myTeam.lookingProfile', 'Your Looking-for-Team Profile')} />
          <div className="px-6 pb-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('teams.portal.myTeam.lookingDesc', 'Describe what you are looking for (skills, project ideas, etc.)')}
            </p>
            <textarea
              value={lookingDescription}
              onChange={(e) => setLookingDescription(e.target.value)}
              placeholder={t('teams.portal.myTeam.lookingDescPlaceholder', 'I am interested in AI/ML projects, have experience with Python and React...')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              rows={3}
            />
            <Button variant="outline" size="sm" onClick={handleSaveLookingDescription} disabled={updatingLooking}>
              {t('common.save', 'Save')}
            </Button>
          </div>
        </PortalCard>
      )}

      {/* ── Received Invitations ── */}
      {receivedInvitations.length > 0 && (
        <PortalCard>
          <PortalCardHeader title={`${t('teams.portal.myTeam.pendingInvitations', 'Pending Invitations')} (${receivedInvitations.length})`} />
          <div className="px-6 pb-6">
            <div className="divide-y">
              {receivedInvitations.map((inv) => (
                <div key={inv.id} className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                      {(inv.team_name ?? 'T')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {inv.team_name ?? t('teams.portal.myTeam.aTeam', 'A team')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('teams.portal.myTeam.invitedYou', 'invited you to join')}
                      </p>
                      {inv.message && (
                        <p className="text-xs text-muted-foreground/80 mt-0.5 italic">&ldquo;{inv.message}&rdquo;</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => handleRespondInvitation(inv.id, 'accept')}>
                      {t('common.accept', 'Accept')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRespondInvitation(inv.id, 'decline')}>
                      {t('common.decline', 'Decline')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PortalCard>
      )}
    </div>
  )
}

/* ========== TeamView ========== */

function TeamView({
  team,
  membership,
  orgSlug,
  competitionId,
}: {
  team: Team
  membership: TeamMember
  orgSlug: string
  competitionId: string
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const isOwner = membership.role === 'owner'

  // Fetch all team members
  const { data: allMembersData } = useQuery({
    queryKey: ['portal-team-members', team.id],
    queryFn: () => fetchCrudList<TeamMember>('teams/members', { team_id: team.id, pageSize: '50' }),
    enabled: !!team.id,
  })

  // Fetch tracks for selection
  const { data: tracksData } = useQuery({
    queryKey: ['portal-tracks', competitionId],
    queryFn: () => fetchCrudList<Track>('tracks/tracks', { competition_id: competitionId, pageSize: '50' }),
    enabled: !!competitionId && isOwner,
  })

  // Fetch invitations for this team
  const { data: invData } = useQuery({
    queryKey: ['portal-invitations', competitionId],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ received: Invitation[]; team_requests: Invitation[] }>(
        `/api/teams/portal/my-invitations?competition_id=${competitionId}`,
      )
      if (ok && result) return result
      return { received: [] as Invitation[], team_requests: [] as Invitation[] }
    },
    enabled: !!competitionId,
  })

  const members = allMembersData?.items ?? []
  const tracks = tracksData?.items ?? []
  const teamRequests = invData?.team_requests ?? []
  const receivedInvitations = invData?.received ?? []

  // Track selection
  const [selectedTrackId, setSelectedTrackId] = React.useState(team.track_id ?? '')

  React.useEffect(() => {
    setSelectedTrackId(team.track_id ?? '')
  }, [team.track_id])

  async function handleSelectTrack(trackId: string) {
    setSelectedTrackId(trackId)
    const { ok } = await apiCall('/api/teams/portal/select-track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ team_id: team.id, track_id: trackId || null }),
    })
    if (ok) {
      flash(t('teams.portal.myTeam.trackSelected', 'Track selected!'), 'success')
      queryClient.invalidateQueries({ queryKey: ['portal-my-team'] })
    } else {
      flash(t('teams.portal.myTeam.trackFailed', 'Failed to select track'), 'error')
    }
  }

  // Respond to join requests (owner only)
  async function handleRespondInvitation(invitationId: string, action: 'accept' | 'decline') {
    const { ok } = await apiCall('/api/teams/portal/respond-invitation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invitation_id: invitationId, action }),
    })
    if (ok) {
      flash(
        action === 'accept'
          ? t('teams.portal.myTeam.requestApproved', 'Join request approved!')
          : t('teams.portal.myTeam.requestDeclined', 'Join request declined'),
        'success',
      )
      queryClient.invalidateQueries({ queryKey: ['portal-invitations'] })
      queryClient.invalidateQueries({ queryKey: ['portal-team-members'] })
    }
  }

  return (
    <div className="space-y-6">
      {/* Team Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <PortalCard>
          <PortalCardHeader title={team.name} />
          <div className="px-6 pb-6 space-y-3">
            {team.description && (
              <p className="text-sm text-muted-foreground">{team.description}</p>
            )}
            <div className="flex items-center gap-3 text-sm">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  team.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : team.status === 'disqualified'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-500'
                }`}
              >
                {team.status}
              </span>
              <span className="text-muted-foreground">
                {t('teams.portal.myTeam.yourRole', 'Your role')}:{' '}
                <strong className="text-foreground capitalize">{membership.role}</strong>
              </span>
            </div>

            {/* Track Selection (owner only) */}
            {isOwner && tracks.length > 0 && (
              <div className="pt-3 border-t">
                <label className="block text-sm font-medium mb-1">
                  {t('teams.portal.myTeam.selectTrack', 'Track')}
                </label>
                <select
                  value={selectedTrackId}
                  onChange={(e) => handleSelectTrack(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-full max-w-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">
                    {t('teams.portal.myTeam.noTrack', '— No track selected —')}
                  </option>
                  {tracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Show selected track for non-owners */}
            {!isOwner && team.track_id && tracks.length > 0 && (
              <div className="pt-3 border-t">
                <span className="text-sm text-muted-foreground">
                  {t('teams.portal.myTeam.track', 'Track')}:{' '}
                  <strong className="text-foreground">
                    {tracks.find((tr) => tr.id === team.track_id)?.name ?? team.track_id}
                  </strong>
                </span>
              </div>
            )}
          </div>
        </PortalCard>

        {/* Members Card */}
        <PortalCard>
          <PortalCardHeader title={t('teams.portal.myTeam.members', 'Team Members')} />
          <div className="px-6 pb-6">
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('teams.portal.myTeam.noMembers', 'No members yet.')}
              </p>
            ) : (
              <div className="divide-y">
                {members.map((m) => (
                  <div key={m.id} className="py-2.5 flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-medium">{m.customer_user_id.slice(0, 8)}...</span>
                    </div>
                    <span
                      className={`text-xs rounded px-1.5 py-0.5 capitalize ${
                        m.role === 'owner'
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PortalCard>
      </div>

      {/* Invitations / Join Requests */}
      {(teamRequests.length > 0 || receivedInvitations.length > 0) && (
        <PortalCard>
          <PortalCardHeader title={t('teams.portal.myTeam.invitations', 'Invitations & Requests')} />
          <div className="px-6 pb-6 space-y-4">
            {/* Join requests to this team (visible to owner) */}
            {isOwner && teamRequests.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">
                  {t('teams.portal.myTeam.joinRequests', 'Join Requests')}
                </h4>
                <div className="divide-y">
                  {teamRequests.map((inv) => (
                    <div key={inv.id} className="py-3 flex items-center justify-between">
                      <div className="text-sm">
                        <span className="font-medium">{inv.invitee_id.slice(0, 8)}...</span>
                        {' '}
                        {t('teams.portal.myTeam.wantsToJoin', 'wants to join')}
                        {inv.message && (
                          <p className="text-muted-foreground text-xs mt-0.5">{inv.message}</p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4 shrink-0">
                        <Button size="sm" onClick={() => handleRespondInvitation(inv.id, 'accept')}>
                          {t('common.approve', 'Approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRespondInvitation(inv.id, 'decline')}
                        >
                          {t('common.decline', 'Decline')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invitations I've received (from other teams) */}
            {receivedInvitations.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">
                  {t('teams.portal.myTeam.receivedInvitations', 'Invitations Received')}
                </h4>
                <div className="divide-y">
                  {receivedInvitations.map((inv) => (
                    <div key={inv.id} className="py-3 flex items-center justify-between">
                      <div className="text-sm">
                        <span className="font-medium">{inv.team_name ?? inv.team_id.slice(0, 8) + '...'}</span>
                        {' '}
                        {t('teams.portal.myTeam.invitedYou', 'invited you to join')}
                        {inv.message && (
                          <p className="text-muted-foreground text-xs mt-0.5">{inv.message}</p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4 shrink-0">
                        <Button size="sm" onClick={() => handleRespondInvitation(inv.id, 'accept')}>
                          {t('common.accept', 'Accept')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRespondInvitation(inv.id, 'decline')}
                        >
                          {t('common.decline', 'Decline')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PortalCard>
      )}
    </div>
  )
}

/* ========== MyTeamContent ========== */

function MyTeamContent({ orgSlug }: { orgSlug: string }) {
  const t = useT()
  const { auth } = usePortalContext()
  const { selectedId } = useCompetitionContext()
  const userId = auth.user?.id

  // Find my team membership
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['portal-my-membership', selectedId, userId],
    queryFn: () => {
      if (!selectedId || !userId)
        return { items: [] as TeamMember[], total: 0, page: 1, pageSize: 50, totalPages: 0 }
      return fetchCrudList<TeamMember>('teams/members', {
        pageSize: '10',
        competition_id: selectedId,
        customer_user_id: userId,
      })
    },
    enabled: !!selectedId && !!userId,
  })

  const myMembership = membersData?.items?.[0]

  // Fetch my team details
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['portal-my-team', myMembership?.team_id],
    queryFn: () => {
      if (!myMembership?.team_id)
        return { items: [] as Team[], total: 0, page: 1, pageSize: 50, totalPages: 0 }
      return fetchCrudList<Team>('teams/teams', { id: myMembership.team_id, pageSize: '1' })
    },
    enabled: !!myMembership?.team_id,
  })

  if (!selectedId) {
    return (
      <PortalEmptyState
        title={t('teams.portal.myTeam.noCompetition', 'Select a competition')}
        description={t(
          'teams.portal.myTeam.noCompetitionDesc',
          'Choose a competition from the header to view your team.',
        )}
      />
    )
  }

  if (membersLoading || teamLoading) {
    return (
      <PortalCard>
        <div className="p-6 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div>
      </PortalCard>
    )
  }

  if (!myMembership) {
    return <NoTeamView orgSlug={orgSlug} competitionId={selectedId} userId={userId!} />
  }

  const team = teamData?.items?.[0]
  if (!team) {
    return (
      <PortalCard>
        <div className="p-6 text-sm text-muted-foreground">
          {t('teams.portal.myTeam.teamNotFound', 'Team not found.')}
        </div>
      </PortalCard>
    )
  }

  return (
    <TeamView
      team={team}
      membership={myMembership}
      orgSlug={orgSlug}
      competitionId={selectedId}
    />
  )
}

/* ========== Page Component ========== */

export default function MyTeamPage({ params }: { params: { orgSlug: string } }) {
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
      <div className="flex flex-col gap-6">
        <PortalPageHeader
          title={t('teams.portal.myTeam.title', 'My Team')}
          label={t('teams.portal.myTeam.label', 'Your team')}
        />
        <MyTeamContent orgSlug={params.orgSlug} />
      </div>
    </CompetitionProvider>
  )
}
