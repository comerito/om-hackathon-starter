"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard } from '@open-mercato/ui/portal/components/PortalCard'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { PortalCompetitionLayout } from '../../../../components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../components/CompetitionContext'
import Link from 'next/link'

/* ---------- types ---------- */

type AgendaItem = {
  id: string; title: string; description: string | null; type: string
  starts_at: string; ends_at: string; location: string | null; speaker_name: string | null
  is_mandatory: boolean
}

type Announcement = {
  id: string; title: string; content: string; priority: string
  pinned: boolean; published_at: string
}

type InvitationsResponse = {
  received: Array<{ id: string }>
  sent: Array<{ id: string }>
  team_join_requests: Array<{ id: string }>
}

type TeamMemberRecord = {
  id: string; team_id: string; customer_user_id: string
  competition_id: string; role: string
}

/* ---------- stage-aware task prompts ---------- */

const taskPrompts: Record<string, { title: string; action: string; path: string }> = {
  draft: { title: 'Competition is being prepared', action: 'View Details', path: '/portal/competition' },
  open: { title: 'Registration is open', action: 'View Competition', path: '/portal/competition' },
  team_formation: { title: 'Form your team', action: 'Go to My Team', path: '/portal/team' },
  track_selection: { title: 'Select a track', action: 'Go to My Team', path: '/portal/team' },
  hacking: { title: 'Start building!', action: 'View Agenda', path: '/portal/agenda' },
  demos: { title: 'Demos are happening', action: 'View Schedule', path: '/portal/agenda' },
  deliberation: { title: 'Judging in progress', action: 'View Announcements', path: '/portal/announcements' },
  finished: { title: 'Results are in!', action: 'View Announcements', path: '/portal/announcements' },
  archived: { title: 'Competition archived', action: 'View Competition', path: '/portal/competition' },
}

const priorityStyles: Record<string, string> = {
  info: 'border-l-4 border-l-blue-400',
  warning: 'border-l-4 border-l-yellow-400 bg-yellow-50/50',
  urgent: 'border-l-4 border-l-red-500 bg-red-50/50',
}

/* ---------- dashboard content ---------- */

function DashboardContent({ orgSlug }: { orgSlug: string }) {
  const t = useT()
  const { selected, selectedId } = useCompetitionContext()
  const { auth } = usePortalContext()
  const userId = auth.user?.id

  // Fetch invitations count
  const { data: invitationsData } = useQuery({
    queryKey: ['portal-dashboard-invitations', selectedId],
    queryFn: async () => {
      if (!selectedId) return { received: [], sent: [], team_join_requests: [] } as InvitationsResponse
      const { ok, result } = await apiCall<InvitationsResponse>(
        `/api/teams/portal/my-invitations?competition_id=${selectedId}`,
      )
      if (!ok || !result) throw new Error('Failed to load invitations')
      return result
    },
    enabled: !!selectedId,
  })

  // Fetch next agenda item
  const { data: agendaData } = useQuery({
    queryKey: ['portal-dashboard-agenda', selectedId],
    queryFn: async () => {
      if (!selectedId) return { items: [] as AgendaItem[] }
      const { ok, result } = await apiCall<{ items: AgendaItem[] }>(
        `/api/competitions/portal/competition-data?competition_id=${selectedId}&type=agenda`,
      )
      if (!ok || !result) throw new Error('Failed to load agenda')
      return result
    },
    enabled: !!selectedId,
  })

  // Fetch latest announcements
  const { data: announcementsData } = useQuery({
    queryKey: ['portal-dashboard-announcements', selectedId],
    queryFn: async () => {
      if (!selectedId) return { items: [] as Announcement[] }
      const { ok, result } = await apiCall<{ items: Announcement[] }>(
        `/api/competitions/portal/competition-data?competition_id=${selectedId}&type=announcements`,
      )
      if (!ok || !result) throw new Error('Failed to load announcements')
      return result
    },
    enabled: !!selectedId,
  })

  // Fetch team membership
  const { data: membershipData } = useQuery({
    queryKey: ['portal-dashboard-membership', selectedId, userId],
    queryFn: async () => {
      if (!selectedId || !userId) return { items: [] as TeamMemberRecord[], total: 0, page: 1, pageSize: 10, totalPages: 0 }
      return fetchCrudList<TeamMemberRecord>('teams/members', {
        competition_id: selectedId,
        customer_user_id: userId,
        pageSize: '10',
      })
    },
    enabled: !!selectedId && !!userId,
  })

  if (!selectedId || !selected) {
    return (
      <PortalCard>
        <div className="p-8 text-center text-muted-foreground">
          {t('competitions.portal.dashboard.noCompetition', 'Select a competition to view your dashboard.')}
        </div>
      </PortalCard>
    )
  }

  const stage = selected.stage
  const task = taskPrompts[stage] ?? taskPrompts.draft
  const prefix = `/${orgSlug}`

  // Find next upcoming agenda item
  const now = new Date()
  const allAgendaItems = agendaData?.items ?? []
  const nextAgendaItem = allAgendaItems.find(item => new Date(item.starts_at) > now) ?? allAgendaItems[0] ?? null

  // Latest announcements (max 3)
  const latestAnnouncements = (announcementsData?.items ?? []).slice(0, 3)

  // Pending invitations
  const pendingCount = (invitationsData?.received?.length ?? 0)
    + (invitationsData?.team_join_requests?.length ?? 0)

  // Team membership
  const myMembership = (membershipData?.items ?? [])[0] ?? null

  return (
    <div className="space-y-6">
      {/* Current Task - Full Width Prominent Card */}
      <PortalCard>
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                {t('competitions.portal.dashboard.currentTask', 'Your Current Task')}
              </p>
              <h2 className="text-xl font-bold">{task.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t('competitions.portal.dashboard.stage', 'Stage')}: <span className="font-medium capitalize text-foreground">{stage.replace('_', ' ')}</span>
              </p>
            </div>
            <Link
              href={`${prefix}${task.path}`}
              className="shrink-0 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              {task.action}
            </Link>
          </div>
        </div>
      </PortalCard>

      {/* Three-Column Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Team Status Card */}
        <PortalCard>
          <div className="p-5">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t('competitions.portal.dashboard.teamStatus', 'Team Status')}
            </h3>
            {myMembership ? (
              <div>
                <p className="text-sm font-medium">
                  {t('competitions.portal.dashboard.inTeam', 'You are in a team')}
                </p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">
                  {t('competitions.portal.dashboard.role', 'Role')}: {myMembership.role}
                </p>
                <Link
                  href={`${prefix}/portal/team`}
                  className="mt-3 inline-flex items-center text-xs font-medium text-primary hover:underline"
                >
                  {t('competitions.portal.dashboard.viewTeam', 'View Team')} &rarr;
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground">
                  {t('competitions.portal.dashboard.noTeam', 'You are not in a team yet.')}
                </p>
                <Link
                  href={`${prefix}/portal/teams`}
                  className="mt-3 inline-flex items-center text-xs font-medium text-primary hover:underline"
                >
                  {t('competitions.portal.dashboard.findTeam', 'Find a Team')} &rarr;
                </Link>
              </div>
            )}
          </div>
        </PortalCard>

        {/* Next Agenda Item Card */}
        <PortalCard>
          <div className="p-5">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t('competitions.portal.dashboard.nextUp', 'Next Up')}
            </h3>
            {nextAgendaItem ? (
              <div>
                <p className="text-sm font-medium">{nextAgendaItem.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(nextAgendaItem.starts_at).toLocaleString([], {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
                {nextAgendaItem.location && (
                  <p className="text-xs text-muted-foreground mt-0.5">{nextAgendaItem.location}</p>
                )}
                <Link
                  href={`${prefix}/portal/agenda`}
                  className="mt-3 inline-flex items-center text-xs font-medium text-primary hover:underline"
                >
                  {t('competitions.portal.dashboard.viewAgenda', 'View Agenda')} &rarr;
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('competitions.portal.dashboard.noAgenda', 'No agenda items yet.')}
              </p>
            )}
          </div>
        </PortalCard>

        {/* Invitations Card */}
        <PortalCard>
          <div className="p-5">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t('competitions.portal.dashboard.invitations', 'Invitations')}
            </h3>
            {pendingCount > 0 ? (
              <div>
                <p className="text-2xl font-bold text-primary">{pendingCount}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('competitions.portal.dashboard.pendingInvitations', 'pending invitation(s)')}
                </p>
                <Link
                  href={`${prefix}/portal/team`}
                  className="mt-3 inline-flex items-center text-xs font-medium text-primary hover:underline"
                >
                  {t('competitions.portal.dashboard.viewInvitations', 'View Invitations')} &rarr;
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('competitions.portal.dashboard.noInvitations', 'No pending invitations.')}
              </p>
            )}
          </div>
        </PortalCard>
      </div>

      {/* Latest Announcements */}
      {latestAnnouncements.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {t('competitions.portal.dashboard.latestAnnouncements', 'Latest Announcements')}
            </h3>
            <Link
              href={`${prefix}/portal/announcements`}
              className="text-xs font-medium text-primary hover:underline"
            >
              {t('competitions.portal.dashboard.viewAll', 'View All')} &rarr;
            </Link>
          </div>
          <div className="space-y-3">
            {latestAnnouncements.map((a) => (
              <PortalCard key={a.id} className={priorityStyles[a.priority] ?? ''}>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.published_at).toLocaleDateString()}
                    </span>
                    {a.priority === 'urgent' && (
                      <span className="text-xs font-medium bg-red-100 text-red-700 rounded px-1.5 py-0.5">
                        {t('competitions.portal.dashboard.urgent', 'Urgent')}
                      </span>
                    )}
                    {a.pinned && (
                      <span className="text-xs font-medium bg-primary/10 text-primary rounded px-1.5 py-0.5">
                        {t('competitions.portal.dashboard.pinned', 'Pinned')}
                      </span>
                    )}
                  </div>
                  <h4 className="font-medium text-sm">{a.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{a.content}</p>
                </div>
              </PortalCard>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- page component ---------- */

export default function DashboardPortalPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <PortalCompetitionLayout>
      <PortalPageHeader
        title={t('competitions.portal.dashboard.title', 'Dashboard')}
        label={t('competitions.portal.dashboard.label', 'Overview')}
      />
      <DashboardContent orgSlug={params.orgSlug} />
    </PortalCompetitionLayout>
  )
}
