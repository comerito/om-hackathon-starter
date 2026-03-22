"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalCardHeader } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { CompetitionProvider, useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { CompetitionSelector } from '../../../../../competitions/components/CompetitionSelector'
import Link from 'next/link'

type Team = {
  id: string; name: string; description: string | null; status: string
  track_id: string | null; _teams?: { memberCount: number }
}

type TeamMember = {
  id: string; team_id: string; customer_user_id: string; role: string; joined_at: string
}

function MyTeamContent({ orgSlug }: { orgSlug: string }) {
  const t = useT()
  const { auth } = usePortalContext()
  const { selectedId } = useCompetitionContext()
  const userId = auth.user?.id

  // Find my team membership
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['portal-my-membership', selectedId, userId],
    queryFn: () => {
      if (!selectedId || !userId) return { items: [] as TeamMember[], total: 0, page: 1, pageSize: 50, totalPages: 0 }
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
      if (!myMembership?.team_id) return { items: [] as Team[], total: 0, page: 1, pageSize: 50, totalPages: 0 }
      return fetchCrudList<Team>('teams/teams', { id: myMembership.team_id, pageSize: '1' })
    },
    enabled: !!myMembership?.team_id,
  })

  // Fetch all team members
  const { data: allMembersData } = useQuery({
    queryKey: ['portal-team-members', myMembership?.team_id],
    queryFn: () => {
      if (!myMembership?.team_id) return { items: [] as TeamMember[], total: 0, page: 1, pageSize: 50, totalPages: 0 }
      return fetchCrudList<TeamMember>('teams/members', { team_id: myMembership.team_id, pageSize: '50' })
    },
    enabled: !!myMembership?.team_id,
  })

  if (!selectedId) {
    return <PortalEmptyState title={t('teams.portal.myTeam.noCompetition', 'Select a competition')} description={t('teams.portal.myTeam.noCompetitionDesc', 'Choose a competition from the header to view your team.')} />
  }

  if (membersLoading || teamLoading) {
    return <PortalCard><div className="p-6 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div></PortalCard>
  }

  if (!myMembership) {
    return (
      <>
        <PortalEmptyState
          title={t('teams.portal.myTeam.noTeam', 'You\'re not on a team yet')}
          description={t('teams.portal.myTeam.noTeamDesc', 'Create a team or join an existing one to get started.')}
        />
        <div className="flex justify-center gap-3 mt-4">
          <Button asChild>
            <Link href={`/${orgSlug}/portal/teams`}>{t('teams.portal.myTeam.browseTeams', 'Browse Teams')}</Link>
          </Button>
        </div>
      </>
    )
  }

  const team = teamData?.items?.[0]
  const members = allMembersData?.items ?? []

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <PortalCard>
        <PortalCardHeader title={team?.name ?? t('teams.portal.myTeam.unnamed', 'My Team')} />
        <div className="px-6 pb-6 space-y-3">
          {team?.description && <p className="text-sm text-muted-foreground">{team.description}</p>}
          <div className="flex items-center gap-3 text-sm">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${team?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {team?.status ?? 'active'}
            </span>
            <span className="text-muted-foreground">{t('teams.portal.myTeam.yourRole', 'Your role')}: <strong className="text-foreground capitalize">{myMembership.role}</strong></span>
          </div>
        </div>
      </PortalCard>

      <PortalCard>
        <PortalCardHeader title={t('teams.portal.myTeam.members', 'Team Members')} />
        <div className="px-6 pb-6">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('teams.portal.myTeam.noMembers', 'No members yet.')}</p>
          ) : (
            <div className="divide-y">
              {members.map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between">
                  <div className="text-sm">
                    <span className="font-medium">{m.customer_user_id.slice(0, 8)}...</span>
                  </div>
                  <span className={`text-xs rounded px-1.5 py-0.5 capitalize ${m.role === 'owner' ? 'bg-primary/10 text-primary font-medium' : 'bg-muted text-muted-foreground'}`}>
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </PortalCard>
    </div>
  )
}

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
        <PortalPageHeader title={t('teams.portal.myTeam.title', 'My Team')} label={t('teams.portal.myTeam.label', 'Your team')} />
        <MyTeamContent orgSlug={params.orgSlug} />
      </div>
    </CompetitionProvider>
  )
}
