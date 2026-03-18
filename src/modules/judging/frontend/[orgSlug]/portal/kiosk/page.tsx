'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { usePortalAppEvent } from '@open-mercato/ui/portal/hooks/usePortalAppEvent'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CurrentDemoResponse {
  current: {
    id: string
    teamName: string | null
    projectTitle: string | null
    status: string
    presentationOrder: number
    presentationDurationMinutes: number
    qaDurationMinutes: number
    actualStart: string | null
  } | null
  onDeck: {
    teamName: string | null
    projectTitle: string | null
    presentationOrder: number
  } | null
  serverTime: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function KioskPage({ params }: { params: { orgSlug: string } }) {
  const { auth } = usePortalContext()
  const { user } = auth

  const [data, setData] = useState<CurrentDemoResponse | null>(null)
  const [competitionId, setCompetitionId] = useState<string | null>(null)
  const [timer, setTimer] = useState({ display: '--:--', isOvertime: false })

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      if (!competitionId) {
        const compRes = await apiCall('/api/competitions/portal/active')
        const comp = compRes?.data?.[0]
        if (comp) setCompetitionId(comp.id)
        if (!comp) return
        const res = await apiCall(`/api/judging/demos/current?competitionId=${comp.id}`)
        setData(res ?? null)
      } else {
        const res = await apiCall(`/api/judging/demos/current?competitionId=${competitionId}`)
        setData(res ?? null)
      }
    } catch {
      // silent
    }
  }, [user, competitionId])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  // Auto-refresh on SSE events
  usePortalAppEvent('judging.demo.status_changed', () => { fetchData() })
  usePortalAppEvent('judging.demo.queue_updated', () => { fetchData() })

  // Timer
  useEffect(() => {
    const current = data?.current
    if (!current?.actualStart) {
      setTimer({ display: '--:--', isOvertime: false })
      return
    }

    const start = new Date(current.actualStart).getTime()
    const duration = (current.status === 'QA' ? current.qaDurationMinutes : current.presentationDurationMinutes) * 60

    function tick() {
      const elapsed = Math.floor((Date.now() - start) / 1000)
      const remaining = Math.max(0, duration - elapsed)
      const m = Math.floor(remaining / 60)
      const s = remaining % 60
      setTimer({
        display: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
        isOvertime: elapsed > duration,
      })
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [data])

  const current = data?.current
  const onDeck = data?.onDeck

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-white select-none">
      {/* Timer — 20% vh */}
      <div className="flex items-center justify-center" style={{ height: '20vh' }}>
        <span
          className={`font-mono font-bold tracking-wider ${
            timer.isOvertime ? 'text-red-500 animate-pulse' : 'text-white'
          }`}
          style={{ fontSize: '16vh', lineHeight: 1 }}
        >
          {timer.display}
        </span>
      </div>

      {/* Team name — 8% vh */}
      <div className="flex items-center justify-center" style={{ height: '8vh' }}>
        {current ? (
          <h1
            className="font-bold text-center px-8 truncate"
            style={{ fontSize: '5vh', lineHeight: 1.2 }}
          >
            {current.teamName ?? 'Team'}
          </h1>
        ) : (
          <h1
            className="font-bold text-center text-white/40"
            style={{ fontSize: '5vh', lineHeight: 1.2 }}
          >
            No Active Demo
          </h1>
        )}
      </div>

      {/* Project title */}
      {current && (
        <div className="mt-2 text-center">
          <p className="text-white/60" style={{ fontSize: '2.5vh' }}>
            {current.projectTitle ?? ''}
          </p>
        </div>
      )}

      {/* Status badge */}
      {current && (
        <div className="mt-4">
          <span
            className={`inline-flex items-center rounded-full px-4 py-1 font-medium ${
              current.status === 'PRESENTING' ? 'bg-green-600' :
              current.status === 'QA' ? 'bg-blue-600' :
              current.status === 'ON_DECK' ? 'bg-yellow-600' :
              'bg-white/20'
            }`}
            style={{ fontSize: '2vh' }}
          >
            {current.status === 'QA' ? 'Q&A' : current.status.replace('_', ' ')}
          </span>
        </div>
      )}

      {/* Presentation order */}
      {current && (
        <div className="mt-2">
          <span className="text-white/40" style={{ fontSize: '2vh' }}>
            #{current.presentationOrder}
          </span>
        </div>
      )}

      {/* On deck indicator */}
      {onDeck && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
          <p className="text-white/30 uppercase tracking-wider" style={{ fontSize: '1.5vh' }}>Up Next</p>
          <p className="text-white/50 font-medium mt-1" style={{ fontSize: '2vh' }}>
            #{onDeck.presentationOrder} - {onDeck.teamName ?? 'Team'}
          </p>
        </div>
      )}
    </div>
  )
}
