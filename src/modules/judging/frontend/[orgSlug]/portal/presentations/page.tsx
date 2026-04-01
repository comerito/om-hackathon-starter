"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { PortalCompetitionLayout } from '../../../../../competitions/components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { cn } from '@open-mercato/shared/lib/utils'
import { useIsMobile } from '@open-mercato/ui/hooks/useIsMobile'
import Link from 'next/link'
import { Rocket, HelpCircle } from 'lucide-react'
import { PortalPageTitle, PortalBadge, AvatarStack, ProgressBar } from '@/components/portal'

type DemoItem = {
  id: string; team_id: string; project_id: string; track_id: string
  team_name: string | null; project_title: string | null
  presentation_order: number; status: string
  actual_start: string | null
  presentation_duration_minutes: number; qa_duration_minutes: number; round: string
}

type QueueResponse = {
  presenting: DemoItem | null; on_deck: DemoItem | null
  queue: DemoItem[]; server_time: number
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const STATUS_STYLES: Record<string, { badge: 'danger' | 'primary' | 'muted' | 'success'; dot: string }> = {
  presenting: { badge: 'danger', dot: 'bg-red-500 dark:bg-red-400' },
  qa: { badge: 'danger', dot: 'bg-red-500 dark:bg-red-400' },
  on_deck: { badge: 'primary', dot: 'bg-portal-primary' },
  waiting: { badge: 'muted', dot: 'bg-gray-400 dark:bg-slate-500' },
  completed: { badge: 'muted', dot: 'bg-gray-300 dark:bg-slate-600' },
  skipped: { badge: 'danger', dot: 'bg-red-300 dark:bg-red-400' },
}

function PresentationsContent({ orgSlug }: { orgSlug: string }) {
  const t = useT()
  const isMobile = useIsMobile()
  const { selectedId: competitionId, isLoading: contextLoading } = useCompetitionContext()
  const [now, setNow] = React.useState(() => Date.now())
  const [clockDelta, setClockDelta] = React.useState(0)

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const { data, isLoading } = useQuery<QueueResponse>({
    queryKey: ['portal-demo-queue', competitionId],
    queryFn: async () => {
      const { ok, result } = await apiCall<QueueResponse>(`/api/judging/portal/current-demo?competition_id=${competitionId}`)
      if (ok && result) {
        setClockDelta(result.server_time - Date.now())
        return result
      }
      return { presenting: null, on_deck: null, queue: [], server_time: Date.now() }
    },
    enabled: !!competitionId,
    refetchInterval: 15000,
  })

  const presenting = data?.presenting
  const onDeck = data?.on_deck
  const queue = data?.queue ?? []

  let timeRemaining: number | null = null
  let timerLabel = ''
  if (presenting?.actual_start && presenting.status === 'presenting') {
    const start = new Date(presenting.actual_start).getTime()
    const duration = presenting.presentation_duration_minutes * 60 * 1000
    timeRemaining = Math.max(0, Math.floor((start + duration - (now + clockDelta)) / 1000))
    timerLabel = t('judging.portal.presentations.timer.presentation', 'Presentation')
  } else if (presenting?.actual_start && presenting.status === 'qa') {
    const start = new Date(presenting.actual_start).getTime()
    const presDuration = presenting.presentation_duration_minutes * 60 * 1000
    const qaDuration = presenting.qa_duration_minutes * 60 * 1000
    timeRemaining = Math.max(0, Math.floor((start + presDuration + qaDuration - (now + clockDelta)) / 1000))
    timerLabel = t('judging.portal.presentations.timer.qa', 'Q&A')
  }
  const isTimerUp = timeRemaining === 0
  const totalDuration = presenting ? (presenting.presentation_duration_minutes + presenting.qa_duration_minutes) * 60 : 0
  const progress = totalDuration > 0 && timeRemaining !== null ? ((totalDuration - timeRemaining) / totalDuration) * 100 : 0

  if (contextLoading || isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-48 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
        <div className="h-64 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-8 text-center text-portal-secondary">
        {t('judging.portal.presentations.empty', 'The presentation queue has not been generated yet.')}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top row: Now Presenting + On Deck */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Now Presenting Hero */}
        {presenting && (
          <div className="rounded-xl border-2 border-dashed border-portal-primary/30 bg-white dark:bg-white/5 p-4 sm:p-6">
            <PortalBadge variant="danger">{t('judging.portal.presentations.nowPresenting', 'Now Presenting')}</PortalBadge>
            <h2 className="mt-2 sm:mt-3 font-display text-xl sm:text-2xl font-bold text-foreground">{presenting.project_title ?? t('judging.portal.presentations.untitled', 'Untitled')}</h2>
            <p className="text-sm text-portal-secondary mt-1">{t('judging.portal.presentations.team', 'Team: {name}', { name: presenting.team_name ?? '-' })}</p>
            {timeRemaining !== null && (
              <div className="mt-3 sm:mt-4 inline-flex flex-col items-center rounded-xl bg-gray-50 dark:bg-white/5 px-4 py-3 sm:px-6 sm:py-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-portal-secondary mb-1">
                  {timerLabel || t('judging.portal.presentations.timeRemaining', 'Time Remaining')}
                </span>
                <span className={cn(
                  'font-mono text-2xl sm:text-4xl font-bold tabular-nums',
                  isTimerUp ? 'text-portal-danger animate-pulse' : timeRemaining < 30 ? 'text-portal-danger' : 'text-portal-tertiary',
                )}>
                  {isTimerUp ? t('judging.portal.presentations.timeUp', "TIME'S UP") : formatTime(timeRemaining)}
                </span>
                <ProgressBar value={progress} size="sm" className="mt-2 w-full" />
              </div>
            )}
          </div>
        )}

        {/* Right side: On Deck + Logistics */}
        <div className="space-y-4">
          {onDeck && (
            <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-portal-secondary">
                {t('judging.portal.presentations.nextUp', 'Next Up (On Deck)')}
              </span>
              <p className="mt-2 text-sm font-bold text-foreground">{onDeck.project_title ?? t('judging.portal.presentations.untitled', 'Untitled')}</p>
              <p className="text-xs text-portal-secondary">{t('judging.portal.presentations.team', 'Team: {name}', { name: onDeck.team_name ?? '-' })}</p>
              <AvatarStack
                avatars={[{ name: onDeck.team_name ?? 'T' }]}
                size="sm"
                className="mt-2"
              />
            </div>
          )}
          <div className="rounded-xl bg-portal-dark p-4">
            <div className="flex items-center gap-2 mb-1">
              <Rocket className="size-4 text-portal-primary-light" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-portal-danger">
                {t('judging.portal.presentations.logistics', 'Logistics Update')}
              </span>
            </div>
            <p className="text-xs text-gray-300">
              {t('judging.portal.presentations.logisticsCopy', 'Teams {start}–{end} please report to Stage B holding area.', {
                start: presenting ? presenting.presentation_order + 3 : '—',
                end: presenting ? presenting.presentation_order + 7 : '—',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Presentation Schedule Table */}
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">{t('judging.portal.presentations.schedule', 'Presentation Schedule')}</h2>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[10px] font-medium uppercase tracking-wide text-portal-secondary">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-500 dark:bg-red-400" /> {t('judging.portal.presentations.legend.presenting', 'Presenting')}</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-portal-primary" /> {t('judging.portal.presentations.legend.onDeck', 'On Deck')}</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-gray-400 dark:bg-slate-500" /> {t('judging.portal.presentations.legend.waiting', 'Waiting')}</span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
          {isMobile ? (
            /* Mobile: card-based list */
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {queue.map((demo) => {
                const status = demo.status === 'qa' ? 'presenting' : demo.status
                const styles = STATUS_STYLES[status] ?? STATUS_STYLES.waiting
                const isCompleted = demo.status === 'completed' || demo.status === 'skipped'
                return (
                  <div key={demo.id} className={cn('px-4 py-3', isCompleted && 'opacity-40')}>
                    <div className="flex items-start gap-3">
                      <span className={cn('font-mono text-lg font-bold shrink-0', demo.status === 'presenting' || demo.status === 'qa' ? 'text-portal-danger' : demo.status === 'on_deck' ? 'text-portal-primary' : 'text-gray-300 dark:text-slate-600')}>
                        {String(demo.presentation_order + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{demo.team_name ?? demo.team_id.substring(0, 8)}</p>
                        <p className="text-xs text-portal-secondary italic truncate">"{demo.project_title}"</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <PortalBadge variant={styles.badge}>{t(`judging.portal.presentations.status.${status}`, status.replace('_', ' '))}</PortalBadge>
                          {(demo.status === 'presenting' || demo.status === 'qa') && (
                            <span className="text-xs font-mono font-bold text-portal-danger">{t('judging.portal.presentations.now', 'NOW')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Desktop: grid table */
            <>
              <div className="grid grid-cols-[50px_1fr_1fr_120px_80px] gap-4 px-5 py-3 border-b border-gray-100 dark:border-white/10 text-[10px] font-semibold uppercase tracking-widest text-portal-secondary">
                <span>{t('judging.portal.presentations.columns.rank', 'Rank')}</span>
                <span>{t('judging.portal.presentations.columns.team', 'Team Name')}</span>
                <span>{t('judging.portal.presentations.columns.project', 'Project Concept')}</span>
                <span>{t('judging.portal.presentations.columns.status', 'Status')}</span>
                <span>{t('judging.portal.presentations.columns.time', 'Time Slot')}</span>
              </div>
              {queue.map((demo) => {
                const status = demo.status === 'qa' ? 'presenting' : demo.status
                const styles = STATUS_STYLES[status] ?? STATUS_STYLES.waiting
                const isCompleted = demo.status === 'completed' || demo.status === 'skipped'
                return (
                  <div
                    key={demo.id}
                    className={cn(
                      'grid grid-cols-[50px_1fr_1fr_120px_80px] gap-4 px-5 py-3 border-b border-gray-50 dark:border-white/5 last:border-0 items-center',
                      isCompleted && 'opacity-40',
                    )}
                  >
                    <span className={cn('font-mono text-lg font-bold', demo.status === 'presenting' || demo.status === 'qa' ? 'text-portal-danger' : demo.status === 'on_deck' ? 'text-portal-primary' : 'text-gray-300 dark:text-slate-600')}>
                      {String(demo.presentation_order + 1).padStart(2, '0')}
                    </span>
                    <p className="text-sm font-semibold text-foreground truncate">{demo.team_name ?? demo.team_id.substring(0, 8)}</p>
                    <p className="text-sm text-portal-secondary italic truncate">"{demo.project_title}"</p>
                    <PortalBadge variant={styles.badge}>{t(`judging.portal.presentations.status.${status}`, status.replace('_', ' '))}</PortalBadge>
                    <span className="text-sm font-mono text-portal-secondary">
                      {demo.status === 'presenting' || demo.status === 'qa' ? t('judging.portal.presentations.now', 'NOW') : '—'}
                    </span>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* Kiosk link */}
      <div className="text-center">
        <Link href={`/${orgSlug}/portal/kiosk`} className="text-sm text-portal-primary font-semibold hover:text-portal-primary-light transition-colors">
          {t('judging.portal.presentations.kioskLink', 'Open full-screen kiosk view ->')}
        </Link>
      </div>

      {/* Help FAB */}
      <div className="fixed bottom-6 right-6 z-50">
        <button type="button" className="size-12 rounded-full bg-portal-primary text-white shadow-lg flex items-center justify-center hover:bg-portal-primary-light transition-colors">
          <HelpCircle className="size-5" />
        </button>
      </div>
    </div>
  )
}

export default function PresentationsPage({ params }: { params: { orgSlug: string } }) {
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
        label={t('judging.portal.presentations.label', 'Live Presentation Queue')}
        title={t('judging.portal.presentations.title', 'Showcase Finale')}
      />
      <PresentationsContent orgSlug={params.orgSlug} />
    </PortalCompetitionLayout>
  )
}
