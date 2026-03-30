"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { PortalCompetitionLayout } from '../../../../../competitions/components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import {
  PortalPageTitle,
  SectionLabel,
  GradientCard,
  PortalBadge,
  ProgressBar,
  ToggleSwitch,
} from '@/components/portal'
import Link from 'next/link'

/* ---------- types ---------- */

type Team = {
  id: string
  name: string
  description: string | null
  status: string
  track_id: string | null
  track_ids?: string[]
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
  color: string
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
      {/* Action Tiles */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Tile 1: Create Team */}
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6 transition-all hover:shadow-md">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-portal-primary/10 text-portal-primary mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" />
            </svg>
          </div>
          <h3 className="font-semibold mb-1">{t('teams.portal.myTeam.createTeam', 'Create a Team')}</h3>
          <p className="text-sm text-portal-secondary mb-4">
            {t('teams.portal.myTeam.noTeamDesc', 'Start your own team and invite others to join.')}
          </p>
          <Button onClick={() => setShowCreateForm(true)} size="sm" className="w-full bg-portal-primary hover:bg-portal-primary/90">
            {t('teams.portal.myTeam.createTeamBtn', 'Create Team')}
          </Button>
        </div>

        {/* Tile 2: Browse Teams */}
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6 transition-all hover:shadow-md">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <h3 className="font-semibold mb-1">{t('teams.portal.myTeam.browseTeams', 'Browse Teams')}</h3>
          <p className="text-sm text-portal-secondary mb-4">
            {t('teams.portal.myTeam.browseTeamsDesc', 'Find an existing team to join or see who is looking for teammates.')}
          </p>
          <Button variant="outline" size="sm" asChild className="w-full">
            <Link href={`/${orgSlug}/portal/teams`}>
              {t('teams.portal.myTeam.browseBtn', 'Browse')}
            </Link>
          </Button>
        </div>

        {/* Tile 3: Looking for Team */}
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6 transition-all hover:shadow-md">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="font-semibold mb-1">{t('teams.portal.myTeam.lookingForTeam', 'Looking for a Team')}</h3>
          <p className="text-sm text-portal-secondary mb-4">
            {t('teams.portal.myTeam.lookingForTeamDesc', 'Let others know you are available to join a team.')}
          </p>
          <div className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-white/10 px-3 py-2.5">
            <ToggleSwitch
              checked={lookingForTeam}
              onChange={handleToggleLooking}
              disabled={updatingLooking}
            />
            <span className="text-sm text-foreground">{t('teams.portal.myTeam.markLooking', 'Mark me as looking')}</span>
          </div>
        </div>
      </div>

      {/* Create Team Expanded Form */}
      {showCreateForm && (
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6">
          <h3 className="text-lg font-semibold mb-4">{t('teams.portal.myTeam.createTeamForm', 'New Team')}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                {t('teams.portal.myTeam.teamName', 'Team Name')} <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={teamName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTeamName(e.target.value)}
                placeholder={t('teams.portal.myTeam.teamNamePlaceholder', 'Enter team name...')}
                className="max-w-md rounded-xl"
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
                className="w-full max-w-md rounded-xl border border-gray-200 dark:border-white/10 bg-background px-3 py-2 text-sm min-h-[80px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-portal-primary dark:placeholder:text-slate-500"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateTeam} disabled={!teamName.trim() || creating} className="bg-portal-primary hover:bg-portal-primary/90">
                {creating ? t('common.saving', 'Saving...') : t('teams.portal.myTeam.createTeamSubmit', 'Create Team')}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Looking for Team Description (expanded) */}
      {lookingForTeam && (
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6">
          <h3 className="text-lg font-semibold mb-3">{t('teams.portal.myTeam.lookingProfile', 'Your Looking-for-Team Profile')}</h3>
          <div className="space-y-3">
            <p className="text-sm text-portal-secondary">
              {t('teams.portal.myTeam.lookingDesc', 'Describe what you are looking for (skills, project ideas, etc.)')}
            </p>
            <textarea
              value={lookingDescription}
              onChange={(e) => setLookingDescription(e.target.value)}
              placeholder={t('teams.portal.myTeam.lookingDescPlaceholder', 'I am interested in AI/ML projects, have experience with Python and React...')}
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-background px-3 py-2 text-sm min-h-[80px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-portal-primary dark:placeholder:text-slate-500"
              rows={3}
            />
            <Button variant="outline" size="sm" onClick={handleSaveLookingDescription} disabled={updatingLooking}>
              {t('common.save', 'Save')}
            </Button>
          </div>
        </div>
      )}

      {/* Received Invitations */}
      {receivedInvitations.length > 0 && (
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6">
          <h3 className="text-lg font-semibold mb-4">
            {t('teams.portal.myTeam.pendingInvitations', 'Pending Invitations')}{' '}
            <PortalBadge variant="info">{receivedInvitations.length}</PortalBadge>
          </h3>
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {receivedInvitations.map((inv) => (
              <div key={inv.id} className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-portal-primary/10 text-portal-primary text-sm font-semibold">
                    {(inv.team_name ?? 'T')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {inv.team_name ?? t('teams.portal.myTeam.aTeam', 'A team')}
                    </p>
                    <p className="text-xs text-portal-secondary">
                      {t('teams.portal.myTeam.invitedYou', 'invited you to join')}
                    </p>
                    {inv.message && (
                      <p className="text-xs text-portal-secondary/80 mt-0.5 italic">&ldquo;{inv.message}&rdquo;</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => handleRespondInvitation(inv.id, 'accept')} className="bg-portal-primary hover:bg-portal-primary/90">
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
      )}
    </div>
  )
}

/* ========== InviteMemberSection ========== */

type SearchResult = { id: string; displayName: string; email: string }

function InviteMemberSection({ teamId, competitionId }: { teamId: string; competitionId: string }) {
  const t = useT()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = React.useState(false)
  const [inviteeId, setInviteeId] = React.useState('')
  const [inviteeName, setInviteeName] = React.useState('')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [showDropdown, setShowDropdown] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Debounced search
  const [debouncedQuery, setDebouncedQuery] = React.useState('')
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Search participants by email/name
  const { data: searchResults } = useQuery({
    queryKey: ['portal-search-participants', competitionId, debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return []
      const { ok, result } = await apiCall<{ items: SearchResult[] }>(
        `/api/competitions/portal/search-participants?competition_id=${competitionId}&q=${encodeURIComponent(debouncedQuery)}`,
      )
      return ok && result ? result.items : []
    },
    enabled: debouncedQuery.length >= 2 && showForm,
  })

  const results = searchResults ?? []

  // Close dropdown on click outside
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelectUser(user: SearchResult) {
    setInviteeId(user.id)
    setInviteeName(`${user.displayName} (${user.email})`)
    setSearchQuery('')
    setShowDropdown(false)
  }

  function handleClearSelection() {
    setInviteeId('')
    setInviteeName('')
    setSearchQuery('')
  }

  async function handleInvite() {
    if (!inviteeId) return
    setSending(true)
    try {
      const { ok, result } = await apiCall<{ ok: boolean; error?: string }>('/api/teams/portal/invite-member', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ team_id: teamId, invitee_id: inviteeId, message: message.trim() || undefined }),
      })
      if (ok) {
        flash(t('teams.portal.myTeam.inviteSent', 'Invitation sent!'), 'success')
        handleClearSelection()
        setMessage('')
        setShowForm(false)
        queryClient.invalidateQueries({ queryKey: ['portal-invitations'] })
      } else {
        flash(result?.error ?? t('teams.portal.myTeam.inviteFailed', 'Failed to send invitation'), 'error')
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="pt-4 mt-4 border-t border-gray-100 dark:border-white/10">
      {!showForm ? (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)} className="w-full rounded-xl">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          {t('teams.portal.myTeam.inviteMember', 'Invite Member')}
        </Button>
      ) : (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">{t('teams.portal.myTeam.inviteMember', 'Invite Member')}</h4>

          {/* Email/Name search with autocomplete */}
          <div>
            <label className="block text-xs font-medium text-portal-secondary mb-1">
              {t('teams.portal.myTeam.searchParticipant', 'Search by email or name')}
            </label>
            {inviteeId ? (
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 px-3 py-2">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-portal-primary/10 text-portal-primary text-[10px] font-semibold">
                  {inviteeName.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm flex-1 truncate">{inviteeName}</span>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-portal-secondary hover:text-foreground text-xs"
                  aria-label="Clear"
                >
                  &times;
                </button>
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <Input
                  type="search"
                  name="participant-search"
                  autoComplete="off"
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setSearchQuery(e.target.value)
                    setShowDropdown(true)
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder={t('teams.portal.myTeam.searchPlaceholder', 'Type email or name...')}
                  className="text-sm rounded-xl"
                  autoFocus
                />
                {showDropdown && searchQuery.length >= 2 && (
                  <div className="absolute z-10 mt-1 w-full rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 shadow-lg max-h-48 overflow-y-auto">
                    {results.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-portal-secondary">
                        {t('teams.portal.myTeam.noResults', 'No participants found')}
                      </div>
                    ) : (
                      results.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => handleSelectUser(user)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-portal-primary/10 text-portal-primary text-xs font-semibold">
                            {(user.displayName || user.email)[0].toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{user.displayName}</p>
                            <p className="text-xs text-portal-secondary truncate">{user.email}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-portal-secondary mb-1">
              {t('teams.portal.myTeam.inviteMessage', 'Message (optional)')}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('teams.portal.myTeam.inviteMessagePlaceholder', 'Hey, want to join our team?')}
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-background px-3 py-2 text-sm min-h-[50px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-portal-primary dark:placeholder:text-slate-500"
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleInvite} disabled={!inviteeId || sending} className="bg-portal-primary hover:bg-portal-primary/90">
              {sending ? t('common.sending', 'Sending...') : t('teams.portal.myTeam.sendInvite', 'Send Invite')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(false); handleClearSelection(); setMessage('') }}>
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ========== TeamView ========== */

/* ---------- Leave Team button component ---------- */
function LeaveTeamButton({ teamId, isOwner, memberCount, orgSlug, competitionStage }: {
  teamId: string; isOwner: boolean; memberCount: number; orgSlug: string; competitionStage?: string
}) {
  const t = useT()
  const router = useRouter()
  const [confirming, setConfirming] = React.useState(false)
  const [leaving, setLeaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Only allow during early stages
  const ALLOWED_LEAVE_STAGES = ['open', 'team_formation', 'track_selection']
  const canLeave = competitionStage ? ALLOWED_LEAVE_STAGES.includes(competitionStage) : false

  if (!canLeave) return null

  async function handleLeave() {
    setLeaving(true)
    setError(null)
    const { ok, result } = await apiCall<{ ok?: boolean; error?: string }>('/api/teams/portal/leave-team', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ team_id: teamId }),
    })
    setLeaving(false)
    if (ok && (result as any)?.ok) {
      flash(t('teams.portal.myTeam.leftTeam', 'You have left the team.'), 'success')
      router.refresh()
      window.location.reload()
    } else {
      setError((result as any)?.error ?? 'Failed to leave team')
    }
  }

  const actionLabel = isOwner && memberCount <= 1
    ? t('teams.portal.myTeam.disbandTeam', 'Disband Team')
    : t('teams.portal.myTeam.leaveTeam', 'Leave Team')

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/10">
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-portal-danger/20 bg-white px-3 py-2 text-xs font-semibold text-portal-danger transition-colors hover:bg-portal-danger/5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
          {actionLabel}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-portal-danger">
            {isOwner && memberCount > 1
              ? t('teams.portal.myTeam.ownerCannotLeave', 'As the owner, remove all members first or transfer ownership.')
              : isOwner
                ? t('teams.portal.myTeam.confirmDisband', 'This will permanently disband the team. Are you sure?')
                : t('teams.portal.myTeam.confirmLeave', 'Are you sure you want to leave this team?')}
          </p>
          {error && (
            <p className="text-xs text-portal-danger bg-portal-danger/5 rounded px-2 py-1">{error}</p>
          )}
          <div className="flex gap-2">
            {!(isOwner && memberCount > 1) && (
              <button
                type="button"
                disabled={leaving}
                onClick={handleLeave}
                className="flex-1 rounded-lg bg-portal-danger px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-portal-danger/90 disabled:opacity-60"
              >
                {leaving ? t('common.saving', 'Saving...') : t('common.confirm', 'Confirm')}
              </button>
            )}
            <button
              type="button"
              onClick={() => { setConfirming(false); setError(null) }}
              className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-slate-400 transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
            >
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TeamView({
  team,
  membership,
  orgSlug,
  competitionId,
  preloadedMembers,
}: {
  team: Team
  membership: TeamMember
  orgSlug: string
  competitionId: string
  preloadedMembers?: Array<TeamMember & { display_name: string; email: string }>
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const { selected } = useCompetitionContext()
  const isOwner = membership.role === 'owner'

  // Fetch tracks for selection
  const { data: tracksData } = useQuery({
    queryKey: ['portal-tracks', competitionId],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ items: Track[] }>(
        `/api/competitions/portal/competition-data?competition_id=${competitionId}&type=tracks`,
      )
      if (!ok || !result) return { items: [] as Track[] }
      return result
    },
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

  const members = preloadedMembers ?? []
  const tracks = tracksData?.items ?? []
  const teamRequests = invData?.team_requests ?? []
  const receivedInvitations = invData?.received ?? []

  // Build name lookup from preloaded members + resolve for invitation users
  const memberNameMap = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const m of members) {
      map.set(m.customer_user_id, (m as any).display_name ?? m.customer_user_id.slice(0, 8) + '...')
    }
    return map
  }, [members])

  const resolveUser = React.useCallback((id: string) => {
    return memberNameMap.get(id) ?? id.slice(0, 8) + '...'
  }, [memberNameMap])

  const resolveInitials = React.useCallback((id: string) => {
    const name = memberNameMap.get(id)
    if (name && !name.includes('...')) {
      const parts = name.split(/\s+/)
      return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
    }
    return id.slice(0, 2).toUpperCase()
  }, [memberNameMap])

  // Track selection — supports multi-track
  const maxTracksPerTeam = (selected as any)?.max_tracks_per_team ?? 1
  const [selectedTrackIds, setSelectedTrackIds] = React.useState<string[]>(
    team.track_ids ?? (team.track_id ? [team.track_id] : []),
  )

  React.useEffect(() => {
    setSelectedTrackIds(team.track_ids ?? (team.track_id ? [team.track_id] : []))
  }, [team.track_id, team.track_ids])

  async function handleToggleTrack(trackId: string) {
    let newIds: string[]
    if (maxTracksPerTeam === 1) {
      // Radio behavior: select this one, deselect others
      newIds = selectedTrackIds.includes(trackId) ? [] : [trackId]
    } else {
      // Checkbox behavior: toggle
      if (selectedTrackIds.includes(trackId)) {
        newIds = selectedTrackIds.filter(id => id !== trackId)
      } else {
        if (selectedTrackIds.length >= maxTracksPerTeam) {
          flash(`Maximum ${maxTracksPerTeam} track(s) allowed`, 'error')
          return
        }
        newIds = [...selectedTrackIds, trackId]
      }
    }
    setSelectedTrackIds(newIds)
    const { ok } = await apiCall('/api/teams/portal/manage-tracks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ team_id: team.id, track_ids: newIds }),
    })
    if (ok) {
      flash(t('teams.portal.myTeam.trackSelected', 'Track updated!'), 'success')
      queryClient.invalidateQueries({ queryKey: ['portal-my-membership'] })
    } else {
      flash(t('teams.portal.myTeam.trackFailed', 'Failed to update tracks'), 'error')
      setSelectedTrackIds(team.track_ids ?? (team.track_id ? [team.track_id] : []))
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

  // Track selection stage check — allow during team_formation and track_selection,
  // and after that only if allowTrackChange is enabled on the competition
  const STAGE_ORDER = ['draft', 'open', 'team_formation', 'track_selection', 'hacking', 'demos', 'deliberation', 'finished', 'archived']
  const currentStage = selected?.stage ?? 'draft'
  const currentStageIdx = STAGE_ORDER.indexOf(currentStage)
  const teamFormationIdx = STAGE_ORDER.indexOf('team_formation')
  const trackSelectionIdx = STAGE_ORDER.indexOf('track_selection')
  const allowTrackChange = (selected as any)?.allow_track_change ?? false
  const canSelectTrack = (currentStageIdx >= teamFormationIdx && currentStageIdx <= trackSelectionIdx)
    || (currentStageIdx > trackSelectionIdx && allowTrackChange)

  // Compute selected track info (first selected track for sidebar display)
  const selectedTrack = tracks.find((tr) => selectedTrackIds.includes(tr.id))
  const selectedTracksAll = tracks.filter((tr) => selectedTrackIds.includes(tr.id))

  // Milestones for the timeline
  const milestones = [
    { label: 'Team formed', done: true },
    { label: 'Track selected', done: selectedTrackIds.length > 0 },
    { label: 'Project submitted', done: team.status === 'submitted' || team.status === 'presented' },
    { label: 'Presentation done', done: team.status === 'presented' },
  ]
  const milestoneDoneCount = milestones.filter((m) => m.done).length
  const milestoneProgress = Math.round((milestoneDoneCount / milestones.length) * 100)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
      {/* ---- Left Column ---- */}
      <div className="space-y-6">
        {/* Active Collaborators */}
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <SectionLabel>Active Collaborators</SectionLabel>
            <PortalBadge variant="primary">{members.length}</PortalBadge>
          </div>

          {members.length === 0 ? (
            <p className="text-sm text-portal-secondary">
              {t('teams.portal.myTeam.noMembers', 'No members yet.')}
            </p>
          ) : (
            <div>
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-4 py-4 border-b border-gray-50 dark:border-white/5 last:border-0">
                  <div className="size-12 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-slate-400">
                    {resolveInitials(m.customer_user_id)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{resolveUser(m.customer_user_id)}</p>
                    <p className="text-xs text-portal-secondary capitalize">{m.role}</p>
                  </div>
                  <PortalBadge variant={m.role === 'owner' ? 'primary' : 'muted'}>
                    {m.role}
                  </PortalBadge>
                </div>
              ))}
            </div>
          )}

          {/* Invite Member (owner only) */}
          {isOwner && <InviteMemberSection teamId={team.id} competitionId={competitionId} />}
        </div>

        {/* Track Selection */}
        {(isOwner || selectedTrackIds.length > 0) && tracks.length > 0 && (
          <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <SectionLabel className="block">{maxTracksPerTeam > 1 ? 'Tracks' : 'Track'}</SectionLabel>
              {maxTracksPerTeam > 1 && (
                <span className="text-xs text-portal-secondary">
                  ({selectedTrackIds.length}/{maxTracksPerTeam})
                </span>
              )}
            </div>

            {!canSelectTrack && isOwner && currentStageIdx < teamFormationIdx && (
              <p className="mb-3 text-xs text-portal-secondary bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-2">
                {t('teams.portal.myTeam.trackNotYet', 'Track selection will open during the team formation stage.')}
              </p>
            )}

            {!canSelectTrack && isOwner && currentStageIdx > trackSelectionIdx && (
              <p className="mb-3 text-xs text-portal-secondary bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-2">
                {t('teams.portal.myTeam.trackLocked', 'Track selection is locked. Changes are no longer allowed.')}
              </p>
            )}

            {isOwner && canSelectTrack ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {tracks.map((track) => {
                  const isSelected = selectedTrackIds.includes(track.id)
                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => handleToggleTrack(track.id)}
                      className={cn(
                        'flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all',
                        isSelected
                          ? 'border-portal-primary bg-portal-primary/5 shadow-sm'
                          : 'border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20 hover:shadow-sm',
                      )}
                    >
                      <div
                        className="size-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${track.color || '#6366f1'}15` }}
                      >
                        <div className="size-4 rounded-full" style={{ backgroundColor: track.color || '#6366f1' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn('text-sm font-bold', isSelected ? 'text-portal-primary' : 'text-foreground')}>
                            {track.name}
                          </p>
                          {isSelected && (
                            <span className="size-5 rounded-full bg-portal-primary flex items-center justify-center">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            </span>
                          )}
                        </div>
                        {track.description && (
                          <p className="text-xs text-portal-secondary mt-0.5 line-clamp-2">{track.description}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              /* Non-owner or locked: show selected track(s) as read-only cards */
              <div className="space-y-2">
                {selectedTracksAll.map((t2) => (
                  <div key={t2.id} className="flex items-start gap-3 rounded-xl border-2 border-portal-primary/30 bg-portal-primary/5 p-4">
                    <div
                      className="size-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${t2.color || '#6366f1'}15` }}
                    >
                      <div className="size-4 rounded-full" style={{ backgroundColor: t2.color || '#6366f1' }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{t2.name}</p>
                      {t2.description && <p className="text-xs text-portal-secondary mt-0.5">{t2.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Invitations / Join Requests */}
        {(teamRequests.length > 0 || receivedInvitations.length > 0) && (
          <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6">
            <SectionLabel className="mb-4 block">
              {t('teams.portal.myTeam.invitations', 'Invitations & Requests')}
            </SectionLabel>
            <div className="space-y-4">
              {/* Join requests to this team (visible to owner) */}
              {isOwner && teamRequests.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    {t('teams.portal.myTeam.joinRequests', 'Join Requests')}
                  </h4>
                  <div className="divide-y divide-gray-50 dark:divide-white/5">
                    {teamRequests.map((inv) => (
                      <div key={inv.id} className="py-3 flex items-center justify-between">
                        <div className="text-sm">
                          <span className="font-semibold">{resolveUser(inv.inviter_id)}</span>
                          {' '}
                          {t('teams.portal.myTeam.wantsToJoin', 'wants to join')}
                          {inv.message && (
                            <p className="text-portal-secondary text-xs mt-0.5">{inv.message}</p>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4 shrink-0">
                          <Button size="sm" onClick={() => handleRespondInvitation(inv.id, 'accept')} className="bg-portal-primary hover:bg-portal-primary/90">
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
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    {t('teams.portal.myTeam.receivedInvitations', 'Invitations Received')}
                  </h4>
                  <div className="divide-y divide-gray-50 dark:divide-white/5">
                    {receivedInvitations.map((inv) => (
                      <div key={inv.id} className="py-3 flex items-center justify-between">
                        <div className="text-sm">
                          <span className="font-semibold">{inv.team_name ?? inv.team_id.slice(0, 8) + '...'}</span>
                          {' '}
                          {t('teams.portal.myTeam.invitedYou', 'invited you to join')}
                          {inv.message && (
                            <p className="text-portal-secondary text-xs mt-0.5">{inv.message}</p>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4 shrink-0">
                          <Button size="sm" onClick={() => handleRespondInvitation(inv.id, 'accept')} className="bg-portal-primary hover:bg-portal-primary/90">
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
          </div>
        )}
      </div>

      {/* ---- Right Column (Sidebar) ---- */}
      <div className="space-y-6">
        {/* Hackathon Progress */}
        <GradientCard>
          <SectionLabel className="!text-white/70 mb-2 block">Hackathon Progress</SectionLabel>
          {selected?.ends_at ? (
            <>
              <p className="font-mono text-4xl font-bold leading-none tracking-tight text-white">
                {(() => {
                  const diff = new Date(selected.ends_at).getTime() - Date.now()
                  const hours = Math.max(0, Math.floor(diff / (1000 * 60 * 60)))
                  return String(hours).padStart(2, '0')
                })()}h
              </p>
              <p className="mt-1 text-sm text-white/70">Remaining until final presentation</p>
            </>
          ) : (
            <p className="text-sm text-white/70">No end date set</p>
          )}
        </GradientCard>

        {/* Team Info Card */}
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
          {/* Team header with colored accent */}
          <div className="relative px-6 pt-5 pb-4">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-portal-primary via-portal-primary-light to-portal-primary" />
            <SectionLabel className="mb-2 block">Team Info</SectionLabel>
            <h3 className="font-display text-lg font-bold tracking-tight text-foreground">{team.name}</h3>
            {team.description && (
              <p className="mt-1 text-xs leading-relaxed text-portal-secondary">{team.description}</p>
            )}
          </div>

          {/* Info rows */}
          <div className="border-t border-gray-50 dark:border-white/5 divide-y divide-gray-50 dark:divide-white/5">
            {/* Status */}
            <div className="flex items-center justify-between px-6 py-3">
              <span className="text-xs text-portal-secondary">{t('teams.portal.myTeam.statusLabel', 'Status')}</span>
              <PortalBadge variant={
                team.status === 'active' ? 'success'
                  : team.status === 'disqualified' ? 'danger'
                    : 'muted'
              }>
                {team.status}
              </PortalBadge>
            </div>

            {/* Your role */}
            <div className="flex items-center justify-between px-6 py-3">
              <span className="text-xs text-portal-secondary">{t('teams.portal.myTeam.yourRole', 'Your role')}</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground capitalize">
                {isOwner && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                    <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
                    <path d="M5.865 17 4 22h16l-1.865-5" />
                  </svg>
                )}
                {membership.role}
              </span>
            </div>

            {/* Members */}
            <div className="flex items-center justify-between px-6 py-3">
              <span className="text-xs text-portal-secondary">{t('teams.portal.myTeam.membersLabel', 'Members')}</span>
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                  {members.slice(0, 4).map((m) => (
                    <div key={m.id} className="size-5 rounded-full bg-gray-200 dark:bg-white/10 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-bold text-gray-500 dark:text-slate-400">
                      {resolveInitials(m.customer_user_id)}
                    </div>
                  ))}
                  {members.length > 4 && (
                    <div className="size-5 rounded-full bg-gray-100 dark:bg-white/10 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-bold text-gray-400 dark:text-slate-500">
                      +{members.length - 4}
                    </div>
                  )}
                </div>
                <span className="text-xs font-semibold text-foreground">{members.length}</span>
              </div>
            </div>

            {/* Track(s) */}
            {selectedTracksAll.length > 0 && (
              <div className="flex items-center justify-between px-6 py-3">
                <span className="text-xs text-portal-secondary">{selectedTracksAll.length > 1 ? t('teams.portal.myTeam.tracksLabel', 'Tracks') : t('teams.portal.myTeam.trackLabel', 'Track')}</span>
                <div className="flex flex-col items-end gap-1">
                  {selectedTracksAll.map((st) => (
                    <div key={st.id} className="flex items-center gap-1.5">
                      <div className="size-2.5 rounded-full" style={{ backgroundColor: st.color || '#6366f1' }} />
                      <span className="text-xs font-semibold text-foreground">{st.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Created */}
            <div className="flex items-center justify-between px-6 py-3">
              <span className="text-xs text-portal-secondary">{t('teams.portal.myTeam.joinedLabel', 'Joined')}</span>
              <span className="text-xs font-medium text-foreground">
                {new Date(membership.joined_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Leave Team */}
          <div className="px-6 pb-5">
            <LeaveTeamButton teamId={team.id} isOwner={isOwner} memberCount={members.length} orgSlug={orgSlug} competitionStage={selected?.stage} />
          </div>
        </div>

        {/* Milestones */}
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6">
          <SectionLabel className="mb-3 block">Milestones</SectionLabel>
          <ProgressBar value={milestoneProgress} label={`${milestoneDoneCount} of ${milestones.length} complete`} size="sm" className="mb-4" />
          <div className="space-y-0">
            {milestones.map((ms, idx) => (
              <div key={idx} className="flex items-start gap-3 relative">
                {/* Connector line */}
                {idx < milestones.length - 1 && (
                  <div className={cn(
                    'absolute left-[7px] top-4 w-0.5 h-full',
                    ms.done ? 'bg-portal-primary' : 'bg-gray-200 dark:bg-white/10',
                  )} />
                )}
                {/* Dot */}
                <div className={cn(
                  'relative z-10 mt-1 size-[15px] rounded-full border-2 shrink-0',
                  ms.done
                    ? 'border-portal-primary bg-portal-primary'
                    : 'border-gray-300 dark:border-white/20 bg-white dark:bg-white/5',
                )}>
                  {ms.done && (
                    <svg className="size-full text-white p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className={cn(
                  'text-sm py-1.5',
                  ms.done ? 'text-foreground font-medium' : 'text-portal-secondary',
                )}>
                  {ms.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ========== MyTeamContent ========== */

type MyMembershipResponse = {
  membership: TeamMember | null
  team: Team | null
  members: Array<TeamMember & { display_name: string; email: string }>
}

function MyTeamContent({ orgSlug }: { orgSlug: string }) {
  const t = useT()
  const { auth } = usePortalContext()
  const { selectedId } = useCompetitionContext()
  const userId = auth.user?.id

  // Fetch membership, team, and members in one call via portal API
  const { data: membershipData, isLoading } = useQuery({
    queryKey: ['portal-my-membership', selectedId, userId],
    queryFn: async () => {
      if (!selectedId) return { membership: null, team: null, members: [] } as MyMembershipResponse
      const { ok, result } = await apiCall<MyMembershipResponse>(
        `/api/teams/portal/my-membership?competition_id=${selectedId}`,
      )
      return ok && result ? result : { membership: null, team: null, members: [] }
    },
    enabled: !!selectedId && !!userId,
  })

  const myMembership = membershipData?.membership
  const team = membershipData?.team
  const preloadedMembers = membershipData?.members

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

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6">
        <p className="text-sm text-portal-secondary">{t('common.loading', 'Loading...')}</p>
      </div>
    )
  }

  if (!myMembership || !team) {
    return <NoTeamView orgSlug={orgSlug} competitionId={selectedId} userId={userId!} />
  }

  return (
    <TeamView
      team={team}
      membership={myMembership}
      orgSlug={orgSlug}
      competitionId={selectedId}
      preloadedMembers={preloadedMembers}
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
    <PortalCompetitionLayout>
      <PortalPageTitle
        label="Workspace"
        title={t('teams.portal.myTeam.title', 'My Team')}
        rightElement={null}
      />
      <MyTeamContent orgSlug={params.orgSlug} />
    </PortalCompetitionLayout>
  )
}
