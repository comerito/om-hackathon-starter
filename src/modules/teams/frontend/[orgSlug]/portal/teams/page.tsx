"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalCard } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@open-mercato/ui/primitives/dialog'
import { cn } from '@open-mercato/shared/lib/utils'
import { Search, Users, UserPlus, Check } from 'lucide-react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { PortalCompetitionLayout } from '../../../../../competitions/components/PortalCompetitionLayout'
import { PortalPageTitle } from '@/components/portal'

/* ---------- types ---------- */

type Team = {
  id: string
  name: string
  description: string | null
  status: string
  track_id: string | null
  _teams?: { memberCount: number }
}

type LookingPerson = {
  customer_user_id: string
  display_name: string | null
  looking_for_team_description: string | null
  skills: string[] | null
}

type Invitation = {
  id: string
  team_id: string
  invitee_id: string
  type: string
  status: string
}

/* ---------- shared visual language with the participants directory ----------
   `/portal/participants` is the reference design for portal browse pages:
   icon-in-search, count pills instead of underline tabs, and a compact card with
   an avatar, a title row, a meta row and a footer action. This page mirrors it so
   the two feel like one product. ------------------------------------------- */

/** Deterministic avatar tint so a given team always gets the same colour. */
const TEAM_AVATAR_COLORS = [
  'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',
  'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
  'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
  'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400',
]

function avatarTint(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return TEAM_AVATAR_COLORS[h % TEAM_AVATAR_COLORS.length]
}

function initialsOf(name: string): string {
  return name.split(' ').map((n) => n.charAt(0)).join('').toUpperCase().slice(0, 2)
}

/** Count pill row — same affordance as the participants directory filters. */
function CountPills({
  options,
  active,
  onChange,
}: {
  options: { id: string; label: string; count: number }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
      <div className="flex items-center gap-1.5 flex-nowrap pr-6">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              'shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors',
              active === o.id
                ? 'bg-portal-primary text-white'
                : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-white/15',
            )}
          >
            {o.label}
            <span className={cn(
              'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              active === o.id ? 'bg-white/20 text-white' : 'bg-white dark:bg-white/10 text-gray-500 dark:text-slate-400',
            )}>
              {o.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400',
  disqualified: 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400',
  withdrawn: 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-slate-400',
}

type TeamMembership = { teamId: string; role: string } | null

/* ========== TeamsTab ========== */

function TeamsTab({
  competitionId,
  pendingTeamIds,
  onRequestJoin,
  myMembership,
  isParticipant,
}: {
  competitionId: string
  pendingTeamIds: Set<string>
  onRequestJoin: (teamId: string) => Promise<void>
  myMembership: TeamMembership
  isParticipant: boolean
}) {
  const t = useT()
  const [search, setSearch] = React.useState('')
  const [requestingId, setRequestingId] = React.useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = React.useState<Team | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['portal-teams', competitionId, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        pageSize: '50',
        sortField: 'name',
        sortDir: 'asc',
        competition_id: competitionId,
      })
      if (search) params.set('name', search)
      const { ok, result } = await apiCall<{ items: Team[]; total: number; page: number; pageSize: number; totalPages: number }>(
        `/api/teams/portal/browse-teams?${params}`,
      )
      if (!ok || !result) return { items: [] as Team[], total: 0, page: 1, pageSize: 50, totalPages: 0 }
      return result
    },
    enabled: !!competitionId,
  })

  const teams = data?.items ?? []

  async function handleRequest(teamId: string) {
    setRequestingId(teamId)
    try {
      await onRequestJoin(teamId)
    } finally {
      setRequestingId(null)
    }
  }

  function renderAction(team: Team) {
    const hasPending = pendingTeamIds.has(team.id)
    if (myMembership) {
      if (myMembership.teamId === team.id) {
        return <span className="text-xs text-primary font-medium">{t('teams.portal.browse.yourTeam', 'Your team')}</span>
      }
      return null
    }
    if (!isParticipant) return null
    if (hasPending) {
      return (
        <span className="text-xs text-muted-foreground italic">
          {t('teams.portal.browse.pendingRequest', 'Request pending')}
        </span>
      )
    }
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={requestingId === team.id}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation()
          handleRequest(team.id)
        }}
      >
        {requestingId === team.id
          ? t('common.sending', 'Sending...')
          : t('teams.portal.browse.requestJoin', 'Request to Join')}
      </Button>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 dark:text-slate-500" />
          <Input
            type="text"
            placeholder={t('teams.portal.browse.search', 'Search teams...')}
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <PortalCard>
          <div className="p-6 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div>
        </PortalCard>
      ) : teams.length === 0 ? (
        <PortalEmptyState
          title={t('teams.portal.browse.empty', 'No teams found')}
          description={
            search
              ? t('teams.portal.browse.emptySearch', 'Try a different search term.')
              : t('teams.portal.browse.emptyAll', 'No teams have been created yet.')
          }
        />
      ) : (
        <div className="grid gap-2.5 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 min-w-0">
          {teams.map((team) => {
            const isMine = myMembership?.teamId === team.id
            return (
              <div
                key={team.id}
                className={cn(
                  'rounded-xl border bg-white dark:bg-white/5 p-3 sm:p-4 flex flex-col min-w-0 transition-colors',
                  isMine
                    ? 'border-portal-primary/40 ring-1 ring-portal-primary/20'
                    : 'border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20',
                )}
              >
                {/* Header: avatar + name + status */}
                <div className="flex items-center gap-3">
                  <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold', avatarTint(team.id))}>
                    {initialsOf(team.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm truncate text-foreground">{team.name}</h3>
                      {isMine && (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-portal-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-portal-primary">
                          <Check className="size-2.5" />
                          {t('teams.portal.browse.yourTeamShort', 'Yours')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="inline-flex items-center gap-1 text-xs text-portal-secondary">
                        <Users className="size-3" />
                        {team._teams?.memberCount ?? '?'} {t('teams.portal.browse.members', 'members')}
                      </span>
                      <span className="text-gray-300 dark:text-slate-600">&middot;</span>
                      <span className={cn('text-xs capitalize', statusStyles[team.status] ? '' : 'text-portal-secondary')}>
                        <span className={cn('inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold', statusStyles[team.status] ?? 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-slate-400')}>
                          {t(`teams.portal.myTeam.status.${team.status}`, team.status)}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {team.description && (
                  <p className="mt-2.5 text-xs text-portal-secondary line-clamp-2">{team.description}</p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-auto pt-2 sm:pt-3">
                  <button
                    type="button"
                    onClick={() => setSelectedTeam(team)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-portal-primary hover:text-portal-primary-light transition-colors"
                  >
                    {t('teams.portal.browse.viewTeam', 'View Team')}
                    <span className="text-xs">&rarr;</span>
                  </button>
                  <div className="flex items-center gap-1">{renderAction(team)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Team detail dialog */}
      <Dialog open={!!selectedTeam} onOpenChange={(open) => { if (!open) setSelectedTeam(null) }}>
        <DialogContent>
          {selectedTeam && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <DialogTitle>{selectedTeam.name}</DialogTitle>
                  <span
                    className={`text-xs rounded px-1.5 py-0.5 capitalize ${statusStyles[selectedTeam.status] ?? 'bg-muted'}`}
                  >
                    {t(`teams.portal.myTeam.status.${selectedTeam.status}`, selectedTeam.status)}
                  </span>
                </div>
                <DialogDescription>
                  {selectedTeam._teams?.memberCount ?? '?'} {t('teams.portal.browse.members', 'members')}
                </DialogDescription>
              </DialogHeader>
              {selectedTeam.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedTeam.description}</p>
              )}
              <div className="flex justify-end pt-2">
                {renderAction(selectedTeam)}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ========== PeopleTab ========== */

function PeopleTab({ competitionId, myMembership, isParticipant }: { competitionId: string; myMembership: TeamMembership; isParticipant: boolean }) {
  const t = useT()
  const queryClient = useQueryClient()
  const [invitingId, setInvitingId] = React.useState<string | null>(null)
  const isOwner = myMembership?.role === 'owner'

  async function handleInvite(userId: string) {
    if (!myMembership?.teamId) return
    setInvitingId(userId)
    try {
      const { ok, result } = await apiCall<{ ok: boolean; error?: string }>('/api/teams/portal/invite-member', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ team_id: myMembership.teamId, invitee_id: userId }),
      })
      if (ok) {
        flash(t('teams.portal.browse.inviteSent', 'Invitation sent!'), 'success')
        queryClient.invalidateQueries({ queryKey: ['portal-looking-for-team'] })
      } else {
        flash(result?.error ?? t('teams.portal.browse.inviteFailed', 'Failed to send invitation'), 'error')
      }
    } finally {
      setInvitingId(null)
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['portal-looking-for-team', competitionId],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ items: LookingPerson[] }>(
        `/api/competitions/portal/looking-for-team?competition_id=${competitionId}`,
      )
      if (ok && result) return result
      return { items: [] as LookingPerson[] }
    },
    enabled: !!competitionId,
  })

  const people = data?.items ?? []

  if (isLoading) {
    return (
      <PortalCard>
        <div className="p-6 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div>
      </PortalCard>
    )
  }

  if (people.length === 0) {
    return (
      <PortalEmptyState
        title={t('teams.portal.browse.noPeople', 'No one is looking for a team')}
        description={t(
          'teams.portal.browse.noPeopleDesc',
          'No one is currently looking for a team. Check back later.',
        )}
      />
    )
  }

  return (
    <div className="grid gap-2.5 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 min-w-0">
      {people.map((person) => {
        const name = person.display_name ?? person.customer_user_id.slice(0, 8) + '...'
        return (
          <div
            key={person.customer_user_id}
            className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-3 sm:p-4 flex flex-col min-w-0"
          >
            {/* Header: avatar + name + LFT badge */}
            <div className="flex items-center gap-3">
              <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold', avatarTint(person.customer_user_id))}>
                {initialsOf(name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm truncate text-foreground">{name}</h3>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-green-700">
                    <Users className="size-2.5" />
                    {t('teams.portal.browse.lookingForTeamShort', 'LFT')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500">
                    <Users className="size-3" />
                    {t('teams.portal.browse.noTeam', 'No Team')}
                  </span>
                </div>
              </div>
            </div>

            {person.looking_for_team_description && (
              <p className="mt-2.5 text-xs text-portal-secondary line-clamp-2">
                {person.looking_for_team_description}
              </p>
            )}

            {person.skills && person.skills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2.5">
                {person.skills.slice(0, 3).map((skill) => (
                  <span key={skill} className="inline-flex items-center rounded-full bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-[10px] text-gray-500 dark:text-slate-400 max-w-[120px] truncate">
                    {skill}
                  </span>
                ))}
                {person.skills.length > 3 && (
                  <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-[10px] text-gray-400 dark:text-slate-500">
                    +{person.skills.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end mt-auto pt-2 sm:pt-3">
              {isOwner && isParticipant && (
                <Button
                  type="button"
                  size="sm"
                  className="bg-green-600 text-[11px] uppercase tracking-wide hover:bg-green-700"
                  disabled={invitingId === person.customer_user_id}
                  onClick={() => handleInvite(person.customer_user_id)}
                >
                  <UserPlus className="size-3.5" />
                  {invitingId === person.customer_user_id
                    ? t('common.sending', 'Sending...')
                    : t('teams.portal.browse.inviteToTeam', 'Invite')}
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ========== TeamsContent ========== */

function TeamsContent() {
  const t = useT()
  const queryClient = useQueryClient()
  const { auth } = usePortalContext()
  const { selectedId, selected, isLoading: contextLoading } = useCompetitionContext()
  const [tab, setTab] = React.useState<'teams' | 'people'>('teams')
  const userId = auth.user?.id
  const isParticipant = selected?.role === 'participant'

  // Fetch my team membership to determine if I'm an owner
  const { data: myMemberData } = useQuery({
    queryKey: ['portal-my-membership-browse', selectedId, userId],
    queryFn: async () => {
      if (!selectedId || !userId) return { items: [] as Array<{ team_id: string; role: string }>, total: 0, page: 1, pageSize: 10, totalPages: 0 }
      const { ok, result } = await apiCall<{ items: Array<{ team_id: string; role: string }>; total: number }>(
        `/api/teams/portal/my-team-membership?competition_id=${selectedId}`,
      )
      if (!ok || !result) return { items: [] as Array<{ team_id: string; role: string }>, total: 0, page: 1, pageSize: 10, totalPages: 0 }
      return result
    },
    enabled: !!selectedId && !!userId,
  })

  const myMembership: TeamMembership = React.useMemo(() => {
    const m = myMemberData?.items?.[0]
    return m ? { teamId: m.team_id, role: m.role } : null
  }, [myMemberData])

  // Fetch my pending join requests to know which teams already have a pending request
  const { data: myInvData } = useQuery({
    queryKey: ['portal-my-join-requests', selectedId],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ received: Invitation[]; sent: Invitation[] }>(
        `/api/teams/portal/my-invitations?competition_id=${selectedId}`,
      )
      if (ok && result) return result
      return { received: [] as Invitation[], sent: [] as Invitation[] }
    },
    enabled: !!selectedId,
  })

  // Counts shown on the pills. Both are cheap list reads and the tabs render
  // from the same queries, so react-query dedupes rather than double-fetching.
  const { data: teamsCountData } = useQuery({
    queryKey: ['portal-teams', selectedId, ''],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: '50', sortField: 'name', sortDir: 'asc', competition_id: selectedId! })
      const { ok, result } = await apiCall<{ items: Team[]; total: number }>(`/api/teams/portal/browse-teams?${params}`)
      if (!ok || !result) return { items: [] as Team[], total: 0 }
      return result
    },
    enabled: !!selectedId,
  })
  const { data: lookingData } = useQuery({
    queryKey: ['portal-looking-for-team', selectedId],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ items: LookingPerson[] }>(
        `/api/competitions/portal/looking-for-team?competition_id=${selectedId}`,
      )
      if (ok && result) return result
      return { items: [] as LookingPerson[] }
    },
    enabled: !!selectedId,
  })
  const teamsCount = teamsCountData?.total ?? teamsCountData?.items?.length ?? 0
  const lookingCount = lookingData?.items?.length ?? 0

  // Build a set of team IDs with pending outgoing join requests
  const pendingTeamIds = React.useMemo(() => {
    const ids = new Set<string>()
    for (const inv of myInvData?.sent ?? []) {
      if (inv.status === 'pending') {
        ids.add(inv.team_id)
      }
    }
    return ids
  }, [myInvData])

  async function handleRequestJoin(teamId: string) {
    const { ok, result } = await apiCall<{ error?: string }>('/api/teams/portal/request-join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ team_id: teamId }),
    })
    if (ok) {
      flash(t('teams.portal.browse.requestSent', 'Join request sent!'), 'success')
      queryClient.invalidateQueries({ queryKey: ['portal-my-join-requests'] })
    } else {
      flash(result?.error ?? t('teams.portal.browse.requestFailed', 'Failed to send request'), 'error')
    }
  }

  if (contextLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!selectedId) {
    return (
      <PortalEmptyState
        title={t('teams.portal.browse.noCompetition', 'Select a competition')}
        description={t('teams.portal.browse.noCompetitionDesc', 'Choose a competition to browse teams.')}
      />
    )
  }

  return (
    <>
      {/* Count pills — same affordance as the participants directory */}
      <div className="mb-4">
        <CountPills
          options={[
            { id: 'teams', label: t('teams.portal.browse.tabTeams', 'Teams'), count: teamsCount },
            { id: 'people', label: t('teams.portal.browse.tabPeople', 'Looking for a team'), count: lookingCount },
          ]}
          active={tab}
          onChange={(id) => setTab(id as 'teams' | 'people')}
        />
      </div>

      {tab === 'teams' ? (
        <TeamsTab
          competitionId={selectedId}
          pendingTeamIds={pendingTeamIds}
          onRequestJoin={handleRequestJoin}
          myMembership={myMembership}
          isParticipant={isParticipant}
        />
      ) : (
        <PeopleTab competitionId={selectedId} myMembership={myMembership} isParticipant={isParticipant} />
      )}
    </>
  )
}

/* ========== Page Component ========== */

export default function TeamBrowserPage({ params }: { params: { orgSlug: string } }) {
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
        label={t('teams.portal.browse.label', 'Find a Team')}
        title={t('teams.portal.browse.title', 'Browse Teams')}
      />
      <TeamsContent />
    </PortalCompetitionLayout>
  )
}
