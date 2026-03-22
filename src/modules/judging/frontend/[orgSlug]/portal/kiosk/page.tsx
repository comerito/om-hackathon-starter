"use client"
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { CompetitionProvider, useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'

type DemoItem = {
  id: string; team_name: string | null; project_title: string | null
  status: string; actual_start: string | null
  presentation_duration_minutes: number; qa_duration_minutes: number
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

function KioskContent() {
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

  // Timer computation
  let timeRemaining: number | null = null
  let phase = ''
  if (presenting?.actual_start) {
    const start = new Date(presenting.actual_start).getTime()
    const correctedNow = now + clockDelta
    if (presenting.status === 'presenting') {
      const duration = presenting.presentation_duration_minutes * 60 * 1000
      timeRemaining = Math.max(0, Math.floor((start + duration - correctedNow) / 1000))
      phase = 'PRESENTATION'
    } else if (presenting.status === 'qa') {
      const presDuration = presenting.presentation_duration_minutes * 60 * 1000
      const qaDuration = presenting.qa_duration_minutes * 60 * 1000
      timeRemaining = Math.max(0, Math.floor((start + presDuration + qaDuration - correctedNow) / 1000))
      phase = 'Q&A'
    }
  }

  const isTimerUp = timeRemaining === 0
  const timerColor = isTimerUp ? '#ef4444' : timeRemaining !== null && timeRemaining < 30 ? '#ef4444' : timeRemaining !== null && timeRemaining < 60 ? '#eab308' : '#22c55e'

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/40 text-[3vh]">Loading...</p>
      </div>
    )
  }

  if (!presenting) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-[4vh] opacity-60">Waiting for next presentation...</p>
          {onDeck && (
            <div className="mt-8">
              <p className="text-yellow-400 text-[3vh] uppercase tracking-wider">Up Next</p>
              <p className="text-white text-[6vh] font-bold mt-2">{onDeck.team_name ?? 'Team'}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-[4vh]">
      {/* Phase indicator */}
      <div className="text-[3vh] uppercase tracking-[0.3em] font-medium mb-[2vh]" style={{ color: timerColor }}>
        {phase}
      </div>

      {/* Team name — minimum 8% viewport height */}
      <h1 className="text-white font-bold text-center leading-tight mb-[2vh]" style={{ fontSize: 'max(8vh, 48px)' }}>
        {presenting.team_name ?? 'Team'}
      </h1>

      {/* Project title */}
      <p className="text-white/60 text-[3vh] text-center mb-[4vh]">
        {presenting.project_title}
      </p>

      {/* Timer — minimum 20% viewport height */}
      {timeRemaining !== null && (
        <div
          className="font-mono font-bold tabular-nums text-center leading-none"
          style={{ fontSize: 'max(20vh, 120px)', color: timerColor }}
          aria-label={`${Math.floor(timeRemaining / 60)} minutes ${timeRemaining % 60} seconds remaining`}
          role="timer"
        >
          {isTimerUp ? "TIME'S UP" : formatTime(timeRemaining)}
        </div>
      )}

      {/* On Deck */}
      {onDeck && (
        <div className="mt-[4vh] text-center">
          <p className="text-yellow-400/80 text-[2vh] uppercase tracking-wider">Next</p>
          <p className="text-white/70 text-[3vh]">{onDeck.team_name ?? 'Team'}</p>
        </div>
      )}
    </div>
  )
}

export default function KioskPage({ params }: { params: { orgSlug: string } }) {
  const { auth } = usePortalContext()
  if (auth.loading || !auth.user) return <div className="min-h-screen bg-black" />

  return (
    <CompetitionProvider>
      <KioskContent />
    </CompetitionProvider>
  )
}
