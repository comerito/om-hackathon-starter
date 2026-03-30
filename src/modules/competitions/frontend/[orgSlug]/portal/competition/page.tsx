"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useCompetitionContext } from '../../../../components/CompetitionContext'
import { PortalCompetitionLayout } from '../../../../components/PortalCompetitionLayout'
import Link from 'next/link'
import { Plus, User, FileText, ArrowRight, Compass } from 'lucide-react'
import { PortalPageTitle, PortalBadge, ProgressBar, GradientCard } from '@/components/portal'

type MyCompetition = {
  id: string; name: string; slug: string; stage: string; role: string
  starts_at: string; ends_at: string; location: string | null; timezone: string
  description?: string | null
}

type Milestone = {
  id: string; name: string; due_date: string; status: string
}

function getTimeRemaining(endDate: string): { hours: number; minutes: number } {
  const diff = Math.max(0, new Date(endDate).getTime() - Date.now())
  return { hours: Math.floor(diff / (1000 * 60 * 60)), minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)) }
}

function CompetitionsContent({ orgSlug }: { orgSlug: string }) {
  const t = useT()
  const { selectedId, setSelectedId } = useCompetitionContext()
  const prefix = `/${orgSlug}/portal`
  const stageLabels: Record<string, string> = {
    draft: t('competitions.portal.competition.stage.draft', 'Draft'),
    open: t('competitions.portal.competition.stage.open', 'Registration Open'),
    team_formation: t('competitions.portal.competition.stage.teamFormation', 'Team Formation'),
    track_selection: t('competitions.portal.competition.stage.trackSelection', 'Track Selection'),
    hacking: t('competitions.portal.competition.stage.hacking', 'Hacking'),
    demos: t('competitions.portal.competition.stage.demos', 'Demos'),
    deliberation: t('competitions.portal.competition.stage.deliberation', 'Deliberation'),
    finished: t('competitions.portal.competition.stage.finished', 'Finished'),
    archived: t('competitions.portal.competition.stage.archived', 'Archived'),
  }
  const roleLabels: Record<string, string> = {
    participant: t('competitions.portal.competition.role.participant', 'Participant'),
    mentor: t('competitions.portal.competition.role.mentor', 'Mentor'),
    judge: t('competitions.portal.competition.role.judge', 'Judge'),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['portal-my-competitions'],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ items: MyCompetition[] }>('/api/competitions/portal/my-competitions')
      if (!ok || !result) throw new Error(t('competitions.portal.competition.error', 'Failed to load'))
      return result
    },
  })

  // Fetch milestones for upcoming deadlines
  const { data: milestonesData } = useQuery({
    queryKey: ['portal-competition-milestones', selectedId],
    queryFn: async () => {
      if (!selectedId) return { items: [] }
      const { ok, result } = await apiCall<{ items: Milestone[] }>(
        `/api/competitions/portal/competition-data?competition_id=${selectedId}&type=milestones`,
      )
      return ok && result ? result : { items: [] }
    },
    enabled: !!selectedId,
  })

  // Fetch stats for project completion
  const { data: statsData } = useQuery({
    queryKey: ['portal-competition-stats', selectedId],
    queryFn: async () => {
      if (!selectedId) return null
      const { ok, result } = await apiCall<{
        participant_count: number; team_count: number; submission_count: number; milestone_count: number
      }>(`/api/competitions/portal/competition-stats?competition_id=${selectedId}`)
      return ok && result ? result : null
    },
    enabled: !!selectedId,
  })

  const items = data?.items ?? []
  const milestones = milestonesData?.items ?? []
  const upcomingMilestones = milestones.filter(m => m.status !== 'completed').slice(0, 2)
  const completedMilestones = milestones.filter(m => m.status === 'completed').length
  const completionPct = milestones.length > 0 ? Math.round((completedMilestones / milestones.length) * 100) : 0

  if (isLoading) {
    return <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-5 sm:p-8 text-center text-portal-secondary">{t('competitions.portal.competition.loading', 'Loading...')}</div>
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-5 sm:p-8 text-center">
        <p className="text-lg font-bold text-foreground mb-2">{t('competitions.portal.competition.empty.title', 'No competitions yet')}</p>
        <p className="text-sm text-portal-secondary">{t('competitions.portal.competition.empty.description', "You haven't been registered in any competition. Contact the organizer to get started.")}</p>
      </div>
    )
  }

  // Active competition = selected one
  const activeComp = items.find(c => c.id === selectedId) ?? items[0]
  const pastComps = items.filter(c => c.id !== activeComp.id)
  const timeLeft = getTimeRemaining(activeComp.ends_at)

  return (
    <div className="space-y-8">
      {/* ===== Active Competition Hero ===== */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Left: Active competition card */}
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-3">
            <PortalBadge variant="primary">{stageLabels[activeComp.stage] ?? activeComp.stage}</PortalBadge>
            <span className="flex items-center gap-1 text-xs text-portal-secondary">
              <User className="size-3" /> {roleLabels[activeComp.role] ?? activeComp.role}
            </span>
            <div className="ml-auto text-right">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-portal-secondary block">{t('competitions.portal.competition.timeRemaining', 'Time Remaining')}</span>
              <span className="text-lg font-bold text-portal-primary">{timeLeft.hours}h {String(timeLeft.minutes).padStart(2, '0')}m</span>
            </div>
          </div>

          <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">{activeComp.name}</h2>
          {activeComp.description && (
            <p className="mt-1 text-sm text-portal-secondary line-clamp-2">{activeComp.description}</p>
          )}

          {/* Project Completion progress */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-foreground">{t('competitions.portal.competition.projectCompletion', 'Project Completion')}</span>
              <span className="text-xs font-bold text-portal-primary">{completionPct}%</span>
            </div>
            <ProgressBar value={completionPct} size="md" />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-5">
            <Link
              href={`${prefix}/project`}
              className="rounded-lg bg-portal-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-portal-primary-light transition-colors"
            >
              {t('competitions.portal.competition.continueProject', 'Continue Project')}
            </Link>
            <Link
              href={`${prefix}/tracks`}
              className="text-sm font-semibold text-foreground hover:text-portal-primary transition-colors"
            >
              {t('competitions.portal.competition.viewGuidelines', 'View Guidelines')}
            </Link>
          </div>
        </div>

        {/* Right: Upcoming Deadlines + Need a Teammate */}
        <div className="flex flex-col gap-4">
          {/* Upcoming Deadlines */}
          <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground mb-3">{t('competitions.portal.competition.upcomingDeadlines', 'Upcoming Deadlines')}</h3>
            {upcomingMilestones.length > 0 ? (
              <div className="space-y-3">
                {upcomingMilestones.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => window.dispatchEvent(new Event('open-milestones-drawer'))}
                    className="flex items-start gap-3 w-full text-left hover:opacity-80 transition-opacity"
                  >
                    <div className="size-8 rounded-lg bg-portal-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="size-4 text-portal-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{m.name}</p>
                      <p className="text-xs text-portal-secondary">
                        {new Date(m.due_date).toLocaleDateString([], { weekday: 'short' })},{' '}
                        {new Date(m.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-portal-secondary">{t('competitions.portal.competition.noUpcomingDeadlines', 'No upcoming deadlines')}</p>
            )}
          </div>

          {/* Need a Teammate CTA */}
          <GradientCard className="flex-1">
            <h3 className="text-sm font-bold text-white">{t('competitions.portal.competition.needTeammate.title', 'Need a Teammate?')}</h3>
            <p className="text-xs text-white/70 mt-1">
              {t('competitions.portal.competition.needTeammate.description', 'Find developers and designers looking for a group in your competition.')}
            </p>
            <Link
              href={`${prefix}/teams`}
              className="mt-3 inline-flex items-center rounded-md bg-white/20 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
            >
              {t('competitions.portal.competition.needTeammate.cta', 'Open Matchmaker')}
            </Link>
          </GradientCard>
        </div>
      </div>

      {/* ===== Past & Drafts ===== */}
      {pastComps.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold text-foreground">{t('competitions.portal.competition.pastDrafts', 'Past & Drafts')}</h2>
            <span className="text-xs font-semibold text-portal-primary cursor-pointer hover:text-portal-primary-light transition-colors">
              {t('competitions.portal.competition.browseAll', 'Browse All Competitions')}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pastComps.map(comp => {
              const isFinished = comp.stage === 'finished' || comp.stage === 'archived'
              return (
                <button
                  key={comp.id}
                  type="button"
                  onClick={() => setSelectedId(comp.id)}
                  className="text-left rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-5 hover:border-portal-primary/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="size-9 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                      <Compass className="size-4 text-portal-secondary" />
                    </div>
                    <PortalBadge variant={isFinished ? 'success' : 'muted'}>
                      {isFinished ? t('competitions.portal.competition.status.completed', 'Completed') : stageLabels[comp.stage] ?? comp.stage}
                    </PortalBadge>
                  </div>
                  <h3 className="text-sm font-bold text-foreground">{comp.name}</h3>
                  <p className="text-xs text-portal-secondary mt-1 line-clamp-2">
                    {roleLabels[comp.role] ?? comp.role} · {new Date(comp.starts_at).toLocaleDateString([], { month: 'short', year: 'numeric' })}
                  </p>
                  <div className="flex items-center gap-1 mt-3 text-xs font-semibold text-portal-primary">
                    {isFinished
                      ? t('competitions.portal.competition.viewResults', 'View Results')
                      : t('competitions.portal.competition.entryIncomplete', 'Entry Incomplete')}
                    <ArrowRight className="size-3" />
                  </div>
                </button>
              )
            })}

            {/* Explore Open Tracks card */}
            <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 p-5 flex flex-col items-center justify-center text-center">
              <div className="size-10 rounded-full bg-portal-primary/10 flex items-center justify-center mb-3">
                <Compass className="size-5 text-portal-primary" />
              </div>
              <h3 className="text-sm font-bold text-foreground">{t('competitions.portal.competition.exploreTracks.title', 'Explore Open Tracks')}</h3>
              <p className="text-xs text-portal-secondary mt-1">
                {t('competitions.portal.competition.exploreTracks.description', 'Discover active hackathons starting this month.')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MyCompetitionsPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth, orgSlug } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <PortalCompetitionLayout>
      <PortalPageTitle
        label={t('competitions.portal.competition.page.label', 'Track your progress and manage your active hackathon entries.')}
        title={t('competitions.portal.competition.page.title', 'My Competitions')}
        rightElement={
          <Link
            href={`/${orgSlug}/portal/tracks`}
            className="flex items-center gap-1.5 rounded-lg border border-portal-primary px-4 py-2 text-sm font-semibold text-portal-primary hover:bg-portal-primary/5 transition-colors"
          >
            <Plus className="size-4" /> {t('competitions.portal.competition.page.joinNew', 'Join New')}
          </Link>
        }
      />
      <CompetitionsContent orgSlug={params.orgSlug} />
    </PortalCompetitionLayout>
  )
}
