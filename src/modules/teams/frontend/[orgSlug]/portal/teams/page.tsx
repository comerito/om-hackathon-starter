"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { CompetitionProvider, useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { CompetitionSelector } from '../../../../../competitions/components/CompetitionSelector'

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

const statusStyles: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  disqualified: 'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-500',
}

/* ========== TeamsTab ========== */

function TeamsTab({
  competitionId,
  pendingTeamIds,
  onRequestJoin,
}: {
  competitionId: string
  pendingTeamIds: Set<string>
  onRequestJoin: (teamId: string) => Promise<void>
}) {
  const t = useT()
  const [search, setSearch] = React.useState('')
  const [requestingId, setRequestingId] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['portal-teams', competitionId, search],
    queryFn: () => {
      const params: Record<string, string> = {
        pageSize: '50',
        sortField: 'name',
        sortDir: 'asc',
        competition_id: competitionId,
      }
      if (search) params.name = search
      return fetchCrudList<Team>('teams/teams', params)
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

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <Input
          type="text"
          placeholder={t('teams.portal.browse.search', 'Search teams...')}
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          className="max-w-sm"
        />
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => {
            const hasPending = pendingTeamIds.has(team.id)
            return (
              <PortalCard key={team.id}>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{team.name}</h3>
                    <span
                      className={`text-xs rounded px-1.5 py-0.5 capitalize ${statusStyles[team.status] ?? 'bg-muted'}`}
                    >
                      {team.status}
                    </span>
                  </div>
                  {team.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{team.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {team._teams?.memberCount ?? '?'} {t('teams.portal.browse.members', 'members')}
                    </span>
                    {hasPending ? (
                      <span className="text-xs text-muted-foreground italic">
                        {t('teams.portal.browse.pendingRequest', 'Request pending')}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={requestingId === team.id}
                        onClick={() => handleRequest(team.id)}
                      >
                        {requestingId === team.id
                          ? t('common.sending', 'Sending...')
                          : t('teams.portal.browse.requestJoin', 'Request to Join')}
                      </Button>
                    )}
                  </div>
                </div>
              </PortalCard>
            )
          })}
        </div>
      )}
    </>
  )
}

/* ========== PeopleTab ========== */

function PeopleTab({ competitionId }: { competitionId: string }) {
  const t = useT()

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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {people.map((person) => (
        <PortalCard key={person.customer_user_id}>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                {(person.display_name ?? '?').charAt(0).toUpperCase()}
              </div>
              <h3 className="font-semibold">
                {person.display_name ?? person.customer_user_id.slice(0, 8) + '...'}
              </h3>
            </div>
            {person.looking_for_team_description && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                {person.looking_for_team_description}
              </p>
            )}
            {person.skills && person.skills.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {person.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        </PortalCard>
      ))}
    </div>
  )
}

/* ========== TeamsContent ========== */

function TeamsContent() {
  const t = useT()
  const queryClient = useQueryClient()
  const { selectedId } = useCompetitionContext()
  const [tab, setTab] = React.useState<'teams' | 'people'>('teams')

  // Fetch my pending join requests to know which teams already have a pending request
  const { data: myInvData } = useQuery({
    queryKey: ['portal-my-join-requests', selectedId],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ received: Invitation[]; team_requests: Invitation[] }>(
        `/api/teams/portal/my-invitations?competition_id=${selectedId}`,
      )
      if (ok && result) return result
      return { received: [] as Invitation[], team_requests: [] as Invitation[] }
    },
    enabled: !!selectedId,
  })

  // Build a set of team IDs with pending outgoing join requests
  const pendingTeamIds = React.useMemo(() => {
    const ids = new Set<string>()
    // team_requests are join_request type invitations where I am the invitee (requesting to join)
    // We also check received for any outgoing requests
    // The API should return join requests I've sent as part of the response
    const allInvitations = [...(myInvData?.received ?? []), ...(myInvData?.team_requests ?? [])]
    for (const inv of allInvitations) {
      if (inv.type === 'join_request' && inv.status === 'pending') {
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
      {/* Tab switcher */}
      <div className="flex items-center gap-1 border-b mb-4">
        <button
          type="button"
          onClick={() => setTab('teams')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'teams'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('teams.portal.browse.tabTeams', 'Teams')}
        </button>
        <button
          type="button"
          onClick={() => setTab('people')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'people'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('teams.portal.browse.tabPeople', 'People Looking for Teams')}
        </button>
      </div>

      {tab === 'teams' ? (
        <TeamsTab
          competitionId={selectedId}
          pendingTeamIds={pendingTeamIds}
          onRequestJoin={handleRequestJoin}
        />
      ) : (
        <PeopleTab competitionId={selectedId} />
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
    <CompetitionProvider>
      <CompetitionSelector />
      <PortalPageHeader
        title={t('teams.portal.browse.title', 'Browse Teams')}
        label={t('teams.portal.browse.label', 'Find a Team')}
      />
      <TeamsContent />
    </CompetitionProvider>
  )
}
