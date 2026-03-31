"use client"
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalCompetitionLayout } from '../../../../../competitions/components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { cn } from '@open-mercato/shared/lib/utils'
import { AvatarStack } from '@/components/portal'

type DemoItem = {
  id: string; team_name: string | null; project_title: string | null
  status: string; actual_start: string | null
  presentation_duration_minutes: number; qa_duration_minutes: number
}

type QueueResponse = {
  presenting: DemoItem | null; on_deck: DemoItem | null
  queue: DemoItem[]; server_time: number
}

function KioskContent() {
  const t = useT()
  const { selectedId: competitionId } = useCompetitionContext()
  const [now, setNow] = React.useState(() => Date.now())
  const [clockDelta, setClockDelta] = React.useState(0)

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(timer)
  }, [])

  const { data, isLoading } = useQuery<QueueResponse>({
    queryKey: ['kiosk-demo', competitionId],
    queryFn: async () => {
      const { ok, result } = await apiCall<QueueResponse>(`/api/judging/portal/current-demo?competition_id=${competitionId}`)
      if (ok && result) { setClockDelta(result.server_time - Date.now()); return result }
      return { presenting: null, on_deck: null, queue: [], server_time: Date.now() }
    },
    enabled: !!competitionId,
    refetchInterval: 10000,
  })

  const presenting = data?.presenting
  const onDeck = data?.on_deck

  let timeRemaining: number | null = null
  let phase = ''
  if (presenting?.actual_start) {
    const start = new Date(presenting.actual_start).getTime()
    const correctedNow = now + clockDelta
    if (presenting.status === 'presenting') {
      const duration = presenting.presentation_duration_minutes * 60 * 1000
      timeRemaining = Math.max(0, Math.floor((start + duration - correctedNow) / 1000))
      phase = t('judging.portal.presentations.timer.presentation', 'Presentation')
    } else if (presenting.status === 'qa') {
      const presDuration = presenting.presentation_duration_minutes * 60 * 1000
      const qaDuration = presenting.qa_duration_minutes * 60 * 1000
      timeRemaining = Math.max(0, Math.floor((start + presDuration + qaDuration - correctedNow) / 1000))
      phase = t('judging.portal.presentations.timer.qa', 'Q&A')
    }
  }

  const isTimerUp = timeRemaining === 0
  const totalDuration = presenting ? (presenting.presentation_duration_minutes + presenting.qa_duration_minutes) * 60 : 0
  const progress = totalDuration > 0 && timeRemaining !== null ? ((totalDuration - timeRemaining) / totalDuration) * 100 : 0

  const minutes = timeRemaining !== null ? Math.floor(timeRemaining / 60) : 0
  const seconds = timeRemaining !== null ? timeRemaining % 60 : 0

  const localTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-portal-dark flex items-center justify-center">
        <p className="text-white/40 text-[3vh]">{t('judging.portal.kiosk.loading', 'Loading...')}</p>
      </div>
    )
  }

  if (!presenting) {
    return (
      <div className="min-h-screen bg-portal-dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/50 text-[4vh]">{t('judging.portal.kiosk.waiting', 'Waiting for next presentation...')}</p>
          {onDeck && (
            <div className="mt-8">
              <p className="text-portal-primary text-[2vh] uppercase tracking-[0.3em]">{t('judging.portal.kiosk.upNext', 'Up Next')}</p>
              <p className="text-white text-[6vh] font-extrabold uppercase mt-2">{onDeck.team_name ?? t('judging.portal.kiosk.teamFallback', 'Team')}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-portal-dark flex flex-col relative overflow-hidden">
      {/* Top status bar */}
      <div className="flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[1.5vh] font-medium uppercase tracking-[0.2em] text-white/50">
            {t('judging.portal.kiosk.livePhase', 'Live Submissions Phase')}
          </span>
        </div>
        <div className="flex items-center gap-6 text-white/40">
          <div className="text-right">
            <span className="text-[1.2vh] uppercase tracking-widest block">{t('judging.portal.kiosk.localTime', 'Local Time')}</span>
            <span className="text-[2vh] font-mono font-bold text-white/60">{localTime}</span>
          </div>
          <div className="text-right">
            <span className="text-[1.2vh] uppercase tracking-widest block">{t('judging.portal.kiosk.status', 'Status')}</span>
            <span className="text-[2vh] font-bold text-green-400">{t('judging.portal.kiosk.active', 'Active')}</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Current team label */}
        <div className="flex items-center gap-4 mb-4">
          <span className="text-portal-primary text-[2vh] font-semibold uppercase tracking-[0.2em]">
            {t('judging.portal.kiosk.currentTeam', 'Current Team')}
          </span>
          <div className="h-px w-12 bg-portal-primary" />
        </div>

        {/* Team name - giant */}
        <h1
          className="text-white font-extrabold text-center uppercase leading-none tracking-tight"
          style={{ fontSize: 'clamp(48px, 10vw, 140px)' }}
        >
          {presenting.team_name ?? t('judging.portal.kiosk.teamUpperFallback', 'TEAM')}
        </h1>

        {/* Project tagline */}
        <p className="text-white/40 text-[2.5vh] text-center mt-2 max-w-4xl">
          {presenting.project_title}
        </p>

        {/* Timer */}
        {timeRemaining !== null && (
          <div className="mt-12" role="timer" aria-label={t('judging.portal.kiosk.timerLabel', '{minutes} minutes {seconds} seconds remaining', { minutes, seconds })}>
            <div className="flex items-baseline justify-center">
              <span className="font-mono font-bold text-white tabular-nums" style={{ fontSize: 'clamp(80px, 18vw, 200px)' }}>
                {String(minutes).padStart(2, '0')}
              </span>
              <span className="font-mono font-bold text-portal-primary mx-2" style={{ fontSize: 'clamp(60px, 14vw, 160px)' }}>
                :
              </span>
              <span className={cn(
                'font-mono font-bold tabular-nums',
                isTimerUp ? 'text-portal-danger' : 'text-portal-primary',
              )} style={{ fontSize: 'clamp(80px, 18vw, 200px)' }}>
                {isTimerUp ? '!!' : String(seconds).padStart(2, '0')}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-4 w-full max-w-2xl mx-auto h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-portal-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Phase labels */}
            <div className="flex items-center justify-between mt-2 text-[1.3vh] uppercase tracking-widest">
              <span className="text-white/30">{phase || t('judging.portal.kiosk.phaseStarted', 'Phase Started')}</span>
              <span className="text-portal-tertiary font-semibold">{t('judging.portal.kiosk.hardDeadline', 'Hard Deadline: 00:00:00')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom: Up Next bar */}
      {onDeck && (
        <div className="flex items-center gap-6 px-8 py-4 bg-white/5 border-t border-white/10">
          <span className="rounded-full bg-orange-100 dark:bg-orange-500/10 px-4 py-1.5 text-xs font-bold uppercase text-orange-800 dark:text-orange-400">
            {t('judging.portal.kiosk.upNextBadge', 'Up Next')}
          </span>
          <div className="flex-1">
            <span className="text-[1.2vh] uppercase tracking-widest text-white/40 block">{t('judging.portal.kiosk.queuePosition', 'Queue Position {position}', { position: '02' })}</span>
            <span className="text-white font-extrabold uppercase text-[2.5vh] tracking-wide">
              {onDeck.team_name ?? t('judging.portal.kiosk.teamUpperFallback', 'TEAM')}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[1.2vh] uppercase tracking-widest text-white/40 block">{t('judging.portal.kiosk.track', 'Track')}</span>
            <span className="text-white font-bold uppercase text-[1.8vh]">{t('judging.portal.kiosk.trackFallback', 'Infrastructure')}</span>
          </div>
          <AvatarStack
            avatars={[
              { name: onDeck.team_name ?? t('judging.portal.kiosk.avatarFallback.team', 'T') },
              { name: t('judging.portal.kiosk.avatarFallback.memberOne', 'M') },
              { name: t('judging.portal.kiosk.avatarFallback.memberTwo', 'A') },
            ]}
            size="sm"
          />
        </div>
      )}
    </div>
  )
}

export default function KioskPage({ params }: { params: { orgSlug: string } }) {
  const { auth } = usePortalContext()
  if (auth.loading || !auth.user) return <div className="min-h-screen bg-portal-dark" />

  return (
    <PortalCompetitionLayout>
      <KioskContent />
    </PortalCompetitionLayout>
  )
}
