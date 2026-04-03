"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { PortalCompetitionLayout } from '../../../../components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../components/CompetitionContext'
import Link from 'next/link'
import {
  Users,
  Compass,
  PlusCircle,
  UserSearch,
  HelpCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Info,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react'
import {
  SectionLabel,
  StatCard,
  GradientCard,
  ProgressBar,
  PortalBadge,
  ActionLink,
  ProfileCompletionCard,
  AnnouncementRichText,
} from '@/components/portal'

/* ---------- types ---------- */

type AgendaItem = {
  id: string; title: string; description: string | null; type: string
  starts_at: string; ends_at: string; location: string | null; speaker_name: string | null
  is_mandatory: boolean
}

type Announcement = {
  id: string; title: string; content: string; priority: string
  pinned: boolean; published_at: string
  category?: string; action_url?: string | null; action_label?: string | null
}

type TeamMemberInfo = {
  id: string; customer_user_id: string; role: string
  joined_at: string; display_name: string; email: string
}

type MyMembershipResponse = {
  membership: { id: string; team_id: string; role: string } | null
  team: { id: string; name: string; description: string | null; status: string; track_id: string | null } | null
  members: TeamMemberInfo[]
}

const priorityIcons: Record<string, { icon: 'info' | 'warning' | 'urgent'; bg: string; fg: string }> = {
  info: { icon: 'info', bg: 'bg-blue-50 dark:bg-blue-500/10', fg: 'text-blue-500 dark:text-blue-400' },
  warning: { icon: 'warning', bg: 'bg-amber-50 dark:bg-amber-500/10', fg: 'text-amber-500 dark:text-amber-400' },
  urgent: { icon: 'urgent', bg: 'bg-red-50 dark:bg-red-500/10', fg: 'text-red-500 dark:text-red-400' },
}

const categoryBadgeVariants: Record<string, 'info' | 'warning' | 'danger' | 'primary' | 'muted'> = {
  logistics: 'info',
  technical: 'warning',
  general: 'muted',
  schedule: 'primary',
  judging: 'danger',
}

/* ---------- helpers ---------- */

function getTimeRemaining(endDate: string): { hours: number; minutes: number } {
  const diff = Math.max(0, new Date(endDate).getTime() - Date.now())
  return { hours: Math.floor(diff / (1000 * 60 * 60)), minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)) }
}

function formatTimeAgo(dateStr: string, t: ReturnType<typeof useT>): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return t('competitions.portal.dashboard.timeAgo.minutes', '{count} minutes ago', { count: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('competitions.portal.dashboard.timeAgo.hours', '{count} hours ago', { count: hours })
  return t('competitions.portal.dashboard.timeAgo.days', '{count} days ago', { count: Math.floor(hours / 24) })
}

/* ---------- announcement card ---------- */

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const t = useT()
  const [expanded, setExpanded] = React.useState(false)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [isClamped, setIsClamped] = React.useState(false)

  const category = announcement.category || 'general'
  const actionUrl = announcement.action_url?.trim() || null
  const actionLabel = announcement.action_label?.trim() || null
  const isCode = announcement.content.includes('npm ') || announcement.content.includes('yarn ')

  const priority = priorityIcons[announcement.priority] ?? priorityIcons.info
  const PriorityIcon = announcement.priority === 'urgent' ? AlertCircle : announcement.priority === 'warning' ? AlertTriangle : Info
  const categoryLabel = t(`competitions.portal.dashboard.announcements.category.${category}`, category)

  // Detect whether text is actually clamped
  React.useEffect(() => {
    const el = contentRef.current
    if (el) setIsClamped(el.scrollHeight > el.clientHeight + 1)
  }, [announcement.content])

  return (
    <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <PortalBadge variant={categoryBadgeVariants[category] ?? 'muted'}>
            {categoryLabel}
          </PortalBadge>
          <span className="text-[10px] font-medium uppercase tracking-wide text-portal-secondary">
            {formatTimeAgo(announcement.published_at, t)}
          </span>
        </div>
        <div className={`size-8 rounded-lg ${priority.bg} flex items-center justify-center`} title={announcement.priority}>
          <PriorityIcon className={`size-4 ${priority.fg}`} />
        </div>
      </div>
      <h4 className="mb-2 text-base font-semibold leading-6 text-foreground sm:text-lg">{announcement.title}</h4>
      {isCode ? (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-gray-50 dark:bg-white/5 px-3 py-2 font-mono text-sm text-portal-secondary sm:text-[15px]">
          <span className="flex-1 truncate">{announcement.content}</span>
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(announcement.content) }}
            className="shrink-0 text-gray-400 dark:text-slate-500 hover:text-foreground"
          >
            <Copy className="size-3.5" />
          </button>
        </div>
      ) : (
        <div
          ref={contentRef}
          className={expanded ? '' : 'line-clamp-3'}
        >
          <AnnouncementRichText content={announcement.content} />
        </div>
      )}
      <div className="flex items-center gap-3 mt-2">
        {!isCode && isClamped && (
          <button
            type="button"
            onClick={() => setExpanded(prev => !prev)}
            className="flex items-center gap-0.5 text-sm font-medium text-portal-primary hover:text-portal-primary-light transition-colors"
          >
            {expanded
              ? t('competitions.portal.dashboard.announcements.showLess', 'Show less')
              : t('competitions.portal.dashboard.announcements.readMore', 'Read more')}
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        )}
        {actionUrl && (
          <ActionLink href={actionUrl}>{actionLabel || actionUrl}</ActionLink>
        )}
      </div>
    </div>
  )
}

/* ---------- quick actions ---------- */

/* ---------- dashboard content ---------- */

function DashboardContent({ orgSlug }: { orgSlug: string }) {
  const t = useT()
  const locale = useLocale()
  const { selected, selectedId, isLoading: contextLoading } = useCompetitionContext()
  const prefix = `/${orgSlug}`
  const stageDisplayTitles: Record<string, string> = {
    draft: t('competitions.portal.dashboard.stage.draft', 'Preparing'),
    open: t('competitions.portal.dashboard.stage.open', 'Registration Open'),
    team_formation: t('competitions.portal.dashboard.stage.teamFormation', 'Team Formation'),
    track_selection: t('competitions.portal.dashboard.stage.trackSelection', 'Track Selection'),
    hacking: t('competitions.portal.dashboard.stage.hacking', 'Hacking in Progress'),
    demos: t('competitions.portal.dashboard.stage.demos', 'Demo Day'),
    deliberation: t('competitions.portal.dashboard.stage.deliberation', 'Judging in Progress'),
    finished: t('competitions.portal.dashboard.stage.finished', 'Results Announced'),
    archived: t('competitions.portal.dashboard.stage.archived', 'Competition Archived'),
  }
  const quickActions = [
    { id: 'tracks', icon: PlusCircle, label: t('competitions.portal.dashboard.quickActions.tracks', 'Join a New Track'), path: '/portal/tracks' },
    { id: 'teams', icon: UserSearch, label: t('competitions.portal.dashboard.quickActions.teams', 'Find a Teammate'), path: '/portal/teams' },
    { id: 'help', icon: HelpCircle, label: t('competitions.portal.dashboard.quickActions.help', 'Request Mentor Help'), path: '/portal/participants' },
  ]

  // Fetch announcements
  const { data: announcementsData } = useQuery({
    queryKey: ['portal-dashboard-announcements', selectedId],
    queryFn: async () => {
      if (!selectedId) return { items: [] as Announcement[] }
      const { ok, result } = await apiCall<{ items: Announcement[] }>(
        `/api/competitions/portal/competition-data?competition_id=${selectedId}&type=announcements`,
      )
      if (!ok || !result) throw new Error(t('competitions.portal.dashboard.errors.announcements', 'Failed to load announcements'))
      return result
    },
    enabled: !!selectedId,
  })

  // Fetch team membership + team details
  const { data: teamData } = useQuery({
    queryKey: ['portal-dashboard-team', selectedId],
    queryFn: async () => {
      if (!selectedId) return null
      const { ok, result } = await apiCall<MyMembershipResponse>(
        `/api/teams/portal/my-membership?competition_id=${selectedId}`,
      )
      if (!ok || !result) return null
      return result
    },
    enabled: !!selectedId,
  })

  // Fetch agenda for next deadline
  const { data: agendaData } = useQuery({
    queryKey: ['portal-dashboard-agenda', selectedId],
    queryFn: async () => {
      if (!selectedId) return { items: [] as AgendaItem[] }
      const { ok, result } = await apiCall<{ items: AgendaItem[] }>(
        `/api/competitions/portal/competition-data?competition_id=${selectedId}&type=agenda`,
      )
      if (!ok || !result) throw new Error(t('competitions.portal.dashboard.errors.agenda', 'Failed to load agenda'))
      return result
    },
    enabled: !!selectedId,
  })

  // Fetch competition stats
  const { data: statsData } = useQuery({
    queryKey: ['portal-dashboard-stats', selectedId],
    queryFn: async () => {
      if (!selectedId) return null
      const { ok, result } = await apiCall<{
        participant_count: number; track_count: number; team_count: number
        submission_count: number; avg_score: number; total_peer_votes: number; milestone_count: number
      }>(`/api/competitions/portal/competition-stats?competition_id=${selectedId}`)
      return ok && result ? result : null
    },
    enabled: !!selectedId,
  })

  // Fetch milestones
  const { data: milestonesData } = useQuery({
    queryKey: ['portal-dashboard-milestones', selectedId],
    queryFn: async () => {
      if (!selectedId) return { items: [] }
      const { ok, result } = await apiCall<{ items: Array<{ id: string; name: string; due_date: string; status: string }> }>(
        `/api/competitions/portal/competition-data?competition_id=${selectedId}&type=milestones`,
      )
      return ok && result ? result : { items: [] }
    },
    enabled: !!selectedId,
  })

  if (contextLoading) {
    return (
      <div className="space-y-4">
        <div className="h-48 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-24 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
          <div className="h-24 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
        </div>
      </div>
    )
  }

  if (!selectedId || !selected) {
    return (
      <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-8 text-center text-portal-secondary">
        {t('competitions.portal.dashboard.noCompetition', 'Select a competition to view your dashboard.')}
      </div>
    )
  }

  const stage = selected.stage
  const isPreStart = ['draft', 'open'].includes(stage)
  const timeLeft = getTimeRemaining(isPreStart ? selected.starts_at : selected.ends_at)
  const latestAnnouncements = (announcementsData?.items ?? []).slice(0, 5)
  const participantCount = statsData?.participant_count ?? 0
  const trackCount = statsData?.track_count ?? 0
  const milestones = milestonesData?.items ?? []
  const completedMilestones = milestones.filter(m => m.status === 'completed').length

  // Find next deadline — from milestones, agenda deadlines, or competition submission deadline
  const now = new Date()
  const agendaDeadline = (agendaData?.items ?? []).find(
    item => item.type === 'deadline' && new Date(item.starts_at) > now,
  )
  // Show first non-completed milestone (upcoming ones first, then active ones even if past due)
  const nextMilestone = milestones.find(m => m.status !== 'completed')
  const nextDeadline = (() => {
    const candidates: Array<{ title: string; date: string }> = []
    if (agendaDeadline) candidates.push({ title: agendaDeadline.title, date: agendaDeadline.starts_at })
    if (nextMilestone) candidates.push({ title: nextMilestone.name, date: nextMilestone.due_date })
    // Also consider the competition's project submission deadline
    if (selected.ends_at) candidates.push({ title: t('competitions.portal.dashboard.finalSubmission', 'Final Submission'), date: selected.ends_at })
    // Pick the soonest future one, or the soonest overall if all are past
    const future = candidates.filter(c => new Date(c.date) > now)
    if (future.length > 0) return future.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
    if (candidates.length > 0) return candidates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    return null
  })()

  // Team info
  const team = teamData?.team
  const members = teamData?.members ?? []
  const maxTeamSize = 4 // Default; could come from competition settings

  return (
    <div className="space-y-6">
      {/* ===== Top Row: Hero (left) + Stats & Deadline (right) ===== */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Hero Status Section */}
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6">
          <SectionLabel>{t('competitions.portal.dashboard.section.status', 'Hackathon Status')}</SectionLabel>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            {stageDisplayTitles[stage] ?? t('competitions.portal.dashboard.stage.fallback', 'In Progress')}
          </h1>
          <div className="mt-3 sm:mt-4 flex flex-wrap items-end gap-3 sm:gap-8">
            <div>
              <span className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">{timeLeft.hours}</span>
              <span className="text-sm sm:text-lg font-bold text-portal-secondary ml-0.5 sm:ml-1">h</span>
              <span className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground ml-2 sm:ml-3">{String(timeLeft.minutes).padStart(2, '0')}</span>
              <span className="text-sm sm:text-lg font-bold text-portal-secondary ml-0.5 sm:ml-1">m</span>
              <span className="ml-1 sm:ml-2 text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-portal-secondary">
                {isPreStart
                  ? t('competitions.portal.dashboard.startsIn', 'Starts in')
                  : t('competitions.portal.dashboard.remaining', 'Remaining')}
              </span>
            </div>
            {milestones.length > 0 && (
              <div>
                <span className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">{String(milestones.length).padStart(2, '0')}</span>
                <span className="ml-1 text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-portal-secondary">
                  {t('competitions.portal.dashboard.milestones', 'Milestones')}
                </span>
              </div>
            )}
          </div>
          {milestones.length > 0 && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('open-milestones-drawer'))}
              className="mt-4 w-full text-left cursor-pointer hover:opacity-80 transition-opacity"
            >
              <ProgressBar
                value={milestones.length > 0 ? (completedMilestones / milestones.length) * 100 : 0}
                label={t('competitions.portal.dashboard.milestonesProgress', '{completed} of {total} milestones completed', {
                  completed: completedMilestones,
                  total: milestones.length,
                })}
                size="md"
              />
            </button>
          )}
        </div>

        {/* Right column: Stat cards + Next Deadline stacked */}
        <div className="flex flex-col gap-4">
          {/* Stat cards row */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              icon={Users}
              value={participantCount.toLocaleString()}
              label={t('competitions.portal.dashboard.stats.participants', 'Participants')}
              href={`${prefix}/portal/participants`}
            />
            <StatCard
              icon={Compass}
              value={String(trackCount).padStart(2, '0')}
              label={t('competitions.portal.dashboard.stats.activeTracks', 'Active Tracks')}
              variant="primary"
              href={`${prefix}/portal/tracks`}
            />
          </div>

          {/* Next Deadline — click opens milestones drawer */}
          {nextDeadline && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('open-milestones-drawer'))}
              className="flex-1 flex flex-col justify-center rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 sm:px-5 sm:py-4 text-left cursor-pointer hover:border-portal-primary/30 hover:shadow-sm transition-all"
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-portal-secondary">
                {t('competitions.portal.dashboard.nextDeadline', 'Next Deadline')}
              </span>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mt-1 gap-1">
                <p className="text-sm font-bold text-foreground">{nextDeadline.title}</p>
                <div className="sm:text-right">
                  <p className="text-xs sm:text-sm font-bold text-portal-primary">
                    {new Date(nextDeadline.date).toLocaleDateString(locale, { weekday: 'long' })},{' '}
                    {new Date(nextDeadline.date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-[10px] text-portal-secondary">
                    {selected.timezone ?? t('competitions.portal.dashboard.localTime', 'Local Time')}
                  </p>
                </div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* ===== Two Column: Announcements + Sidebar ===== */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left: Announcements */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">
              {t('competitions.portal.dashboard.latestAnnouncements', 'Latest Announcements')}
            </h2>
            <Link
              href={`${prefix}/portal/announcements`}
              className="text-xs font-semibold text-portal-primary hover:text-portal-primary-light transition-colors"
            >
              {t('competitions.portal.dashboard.viewAll', 'View All')}
            </Link>
          </div>
          <div className="space-y-3">
            {latestAnnouncements.length > 0 ? (
              latestAnnouncements.map((a) => (
                <AnnouncementCard key={a.id} announcement={a} />
              ))
            ) : (
              <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-6 text-center text-sm text-portal-secondary">
                {t('competitions.portal.dashboard.noAnnouncements', 'No announcements yet.')}
              </div>
            )}
          </div>
          {latestAnnouncements.length > 0 && (
            <button
              type="button"
              className="mt-4 flex w-full items-center justify-center gap-1 text-xs font-medium text-portal-secondary hover:text-foreground transition-colors"
            >
              {t('competitions.portal.dashboard.loadOlder', 'Load Older Announcements')}
            </button>
          )}
        </div>

        {/* Right: Sidebar widgets */}
        <div className="space-y-4">
          {/* Profile Completion */}
          <ProfileCompletionCard profileLink={`${prefix}/portal/profile`} />

          {/* Quick Actions */}
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-portal-secondary">
              {t('competitions.portal.dashboard.quickActions', 'Quick Actions')}
            </span>
            <div className="mt-2 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 divide-y divide-gray-50 dark:divide-white/5">
              {quickActions.map((action) => (
                <Link
                  key={action.id}
                  href={`${prefix}${action.path}`}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-gray-50 dark:hover:bg-white/5 transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  <action.icon className="size-4 text-portal-primary" />
                  <span className="flex-1 font-medium">{action.label}</span>
                  <ChevronRight className="size-4 text-gray-300 dark:text-slate-600" />
                </Link>
              ))}
            </div>
          </div>

          {/* Team Summary */}
          {team && (
            <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="size-2 rounded-full bg-portal-primary" />
                <span className="text-sm font-bold text-foreground">
                  {t('competitions.portal.dashboard.myTeam', 'My Team: {name}', { name: team.name })}
                </span>
              </div>
              <div className="space-y-2.5">
                {members.slice(0, 3).map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <div className="size-7 rounded-full bg-portal-primary/10 flex items-center justify-center text-[10px] font-bold text-portal-primary">
                      {member.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{member.display_name}</p>
                      <p className="text-[10px] text-portal-secondary capitalize">{member.role}</p>
                    </div>
                    <div className="size-2 rounded-full bg-green-400" />
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-portal-secondary">
                  {t('competitions.portal.dashboard.teamCapacity', 'Team Capacity')}
                </span>
                <ProgressBar
                  value={(members.length / maxTeamSize) * 100}
                  label={t('competitions.portal.dashboard.teamCapacityProgress', '{filled} of {total} slots filled', {
                    filled: members.length,
                    total: maxTeamSize,
                  })}
                  size="sm"
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Resources Gradient Card */}
          <GradientCard>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
              {t('competitions.portal.dashboard.resources', 'Resources')}
            </span>
            <h3 className="mt-1 text-lg font-bold text-white">
              {t('competitions.portal.dashboard.competitionGuide', 'Competition Guide')}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-white/80">
              {t(
                'competitions.portal.dashboard.competitionGuideDescription',
                'See the full competition flow, from registration and team setup to demos, judging, and final results.',
              )}
            </p>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-competition-guide-drawer', {
                detail: { currentStage: stage },
              }))}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-white/20 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
            >
              {t('competitions.portal.dashboard.openGuide', 'Open Guide')}
            </button>
          </GradientCard>
        </div>
      </div>
    </div>
  )
}

/* ---------- page component ---------- */

export default function DashboardPortalPage({ params }: { params: { orgSlug: string } }) {
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <PortalCompetitionLayout>
      <DashboardContent orgSlug={params.orgSlug} />
    </PortalCompetitionLayout>
  )
}
