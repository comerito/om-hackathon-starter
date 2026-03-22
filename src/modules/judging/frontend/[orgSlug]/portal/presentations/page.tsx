"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { CompetitionProvider, useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { CompetitionSelector } from '../../../../../competitions/components/CompetitionSelector'
import Link from 'next/link'

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
  return `${m}:${s.toString().padStart(2, '0')}`
}

function PresentationsContent({ orgSlug }: { orgSlug: string }) {
  const t = useT()
  const { selectedId: competitionId } = useCompetitionContext()
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

  // Compute timer
  let timeRemaining: number | null = null
  let timerLabel = ''
  if (presenting?.actual_start && presenting.status === 'presenting') {
    const start = new Date(presenting.actual_start).getTime()
    const duration = presenting.presentation_duration_minutes * 60 * 1000
    const correctedNow = now + clockDelta
    timeRemaining = Math.max(0, Math.floor((start + duration - correctedNow) / 1000))
    timerLabel = t('judging.portal.presentation', 'Presentation')
  } else if (presenting?.actual_start && presenting.status === 'qa') {
    const start = new Date(presenting.actual_start).getTime()
    const presDuration = presenting.presentation_duration_minutes * 60 * 1000
    const qaDuration = presenting.qa_duration_minutes * 60 * 1000
    const correctedNow = now + clockDelta
    timeRemaining = Math.max(0, Math.floor((start + presDuration + qaDuration - correctedNow) / 1000))
    timerLabel = t('judging.portal.qa', 'Q&A')
  }
  const isTimerUp = timeRemaining === 0

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">{t('common.loading', 'Loading...')}</div>

  if (queue.length === 0) {
    return <PortalEmptyState title={t('judging.portal.noQueue', 'No Presentations')} description={t('judging.portal.noQueueDesc', 'The presentation queue has not been generated yet.')} />
  }

  return (
    <div className="space-y-6">
      {/* Now Presenting */}
      {presenting && (
        <PortalCard>
          <div className="p-6 text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{timerLabel || t('judging.portal.nowPresenting', 'Now Presenting')}</div>
            <h2 className="text-2xl font-bold mb-1">{presenting.team_name ?? 'Team'}</h2>
            <p className="text-muted-foreground mb-4">{presenting.project_title}</p>
            {timeRemaining !== null && (
              <div className={`text-5xl font-mono font-bold tabular-nums ${isTimerUp ? 'text-red-600 animate-pulse' : timeRemaining < 30 ? 'text-red-500' : timeRemaining < 60 ? 'text-yellow-500' : 'text-primary'}`}
                aria-label={`${Math.floor(timeRemaining / 60)} minutes ${timeRemaining % 60} seconds remaining`}>
                {isTimerUp ? t('judging.portal.timesUp', "TIME'S UP") : formatTime(timeRemaining)}
              </div>
            )}
          </div>
        </PortalCard>
      )}

      {/* On Deck */}
      {onDeck && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center">
          <div className="text-xs uppercase tracking-wider text-yellow-600 mb-1">{t('judging.portal.onDeck', 'On Deck')}</div>
          <p className="font-semibold text-yellow-800">{onDeck.team_name ?? 'Team'}</p>
          <p className="text-sm text-yellow-700">{onDeck.project_title}</p>
        </div>
      )}

      {/* Full Queue */}
      <PortalCard>
        <PortalCardHeader title={t('judging.portal.queueTitle', 'Presentation Queue')} />
        <div className="divide-y">
          {queue.map((demo) => (
            <div key={demo.id} className={`flex items-center gap-4 px-6 py-3 ${demo.status === 'presenting' || demo.status === 'qa' ? 'bg-primary/5' : demo.status === 'on_deck' ? 'bg-yellow-50' : demo.status === 'completed' || demo.status === 'skipped' ? 'opacity-50' : ''}`}>
              <span className="w-8 text-center font-mono text-sm text-muted-foreground">{demo.presentation_order + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{demo.team_name ?? demo.team_id.substring(0, 8)}</p>
                <p className="text-xs text-muted-foreground truncate">{demo.project_title}</p>
              </div>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                demo.status === 'presenting' || demo.status === 'qa' ? 'bg-green-100 text-green-800' :
                demo.status === 'on_deck' ? 'bg-yellow-100 text-yellow-800' :
                demo.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                demo.status === 'skipped' ? 'bg-red-100 text-red-600' :
                'bg-muted text-muted-foreground'
              }`}>
                {demo.status.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </PortalCard>

      {/* Kiosk link */}
      <div className="text-center">
        <Link href={`/${orgSlug}/portal/kiosk`} className="text-sm text-primary underline">
          {t('judging.portal.openKiosk', 'Open full-screen kiosk view')}
        </Link>
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
    <CompetitionProvider>
      <CompetitionSelector />
      <div className="flex flex-col gap-6">
        <PortalPageHeader title={t('judging.portal.presentationsTitle', 'Presentations')} label={t('judging.portal.presentationsLabel', 'Live demo queue')} />
        <PresentationsContent orgSlug={params.orgSlug} />
      </div>
    </CompetitionProvider>
  )
}
