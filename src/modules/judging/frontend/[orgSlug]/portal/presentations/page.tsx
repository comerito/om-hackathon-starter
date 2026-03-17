'use client'

import { useEffect, useState, useCallback } from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components'
import { PortalEmptyState } from '@open-mercato/ui/portal/components'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { usePortalAppEvent } from '@open-mercato/ui/portal/hooks/usePortalAppEvent'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DemoSession {
  id: string
  competitionId: string
  teamId: string
  projectId: string
  trackId: string
  presentationOrder: number
  presentationDurationMinutes: number
  qaDurationMinutes: number
  status: string
  actualStart: string | null
  round: string
}

interface CurrentDemoResponse {
  current: {
    id: string
    teamId: string
    teamName: string | null
    projectId: string
    projectTitle: string | null
    status: string
    presentationOrder: number
    presentationDurationMinutes: number
    qaDurationMinutes: number
    actualStart: string | null
  } | null
  onDeck: {
    id: string
    teamId: string
    teamName: string | null
    projectTitle: string | null
    presentationOrder: number
  } | null
  serverTime: string
}

// ---------------------------------------------------------------------------
// Timer hook
// ---------------------------------------------------------------------------

function useLiveTimer(startTime: string | null, durationMinutes: number) {
  const [display, setDisplay] = useState('--:--')
  const [isOvertime, setIsOvertime] = useState(false)

  useEffect(() => {
    if (!startTime) { setDisplay('--:--'); return }
    const start = new Date(startTime).getTime()
    const total = durationMinutes * 60

    function tick() {
      const elapsed = Math.floor((Date.now() - start) / 1000)
      const remaining = Math.max(0, total - elapsed)
      const m = Math.floor(remaining / 60)
      const s = remaining % 60
      setDisplay(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
      setIsOvertime(elapsed > total)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startTime, durationMinutes])

  return { display, isOvertime }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PresentationsPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const { auth } = usePortalContext()
  const { user } = auth

  const [demos, setDemos] = useState<DemoSession[]>([])
  const [currentDemo, setCurrentDemo] = useState<CurrentDemoResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [competitionId, setCompetitionId] = useState<string | null>(null)
  const [myTeamId, setMyTeamId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      // Get active competition
      const compRes = await apiCall('/api/competitions/competitions?isActive=true&pageSize=1')
      const comp = compRes?.data?.[0]
      if (!comp) { setLoading(false); return }
      setCompetitionId(comp.id)

      // Get my team
      const memberRes = await apiCall(`/api/teams/members?competitionId=${comp.id}&customerUserId=${user.id}&pageSize=1`)
      const member = memberRes?.data?.[0]
      if (member) setMyTeamId(member.teamId ?? member.team_id)

      // Get demo queue
      const [demoRes, currentRes] = await Promise.all([
        apiCall(`/api/judging/demos?competitionId=${comp.id}&pageSize=100&sortField=presentation_order&sortDir=asc`),
        apiCall(`/api/judging/demos/current?competitionId=${comp.id}`),
      ])

      setDemos(demoRes?.items ?? [])
      setCurrentDemo(currentRes ?? null)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  // Refresh on demo status changes
  usePortalAppEvent('judging.demo.status_changed', () => { fetchData() })
  usePortalAppEvent('judging.demo.queue_updated', () => { fetchData() })

  const current = currentDemo?.current
  const onDeck = currentDemo?.onDeck

  const timer = useLiveTimer(
    current?.actualStart ?? null,
    current?.status === 'QA' ? (current?.qaDurationMinutes ?? 2) : (current?.presentationDurationMinutes ?? 3),
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (demos.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <PortalPageHeader title={t('judging.portal.presentations.title', 'Presentations')} />
        <PortalEmptyState
          title={t('judging.portal.presentations.empty', 'No presentations scheduled')}
          description="The demo queue has not been generated yet."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader title={t('judging.portal.presentations.title', 'Presentations')} />

      {/* Currently presenting */}
      {current && (
        <PortalCard className="border-primary/30 bg-primary/5">
          <PortalCardHeader
            label={current.status === 'QA' ? 'Q&A Session' : 'Now Presenting'}
            title={`#${current.presentationOrder} - ${current.teamName ?? 'Team'}`}
          />
          <p className="text-muted-foreground mt-1">{current.projectTitle ?? 'Untitled Project'}</p>
          <div className="mt-3">
            <span className={`font-mono text-4xl font-bold ${timer.isOvertime ? 'text-destructive' : 'text-primary'}`}>
              {timer.display}
            </span>
          </div>
        </PortalCard>
      )}

      {/* On deck */}
      {onDeck && (
        <PortalCard className="border-yellow-200 dark:border-yellow-800">
          <PortalCardHeader label="Up Next" title={`#${onDeck.presentationOrder} - ${onDeck.teamName ?? 'Team'}`} />
          <p className="text-muted-foreground mt-1">{onDeck.projectTitle ?? 'Untitled Project'}</p>
        </PortalCard>
      )}

      {/* Full queue */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Queue</h3>
        {demos.map((demo) => {
          const isMyTeam = demo.teamId === myTeamId
          const isCurrent = current?.id === demo.id
          return (
            <div
              key={demo.id}
              className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                isCurrent ? 'border-primary bg-primary/5' : ''
              } ${isMyTeam ? 'ring-2 ring-yellow-400' : ''}`}
            >
              <div className="flex items-center gap-3">
                <span className="w-8 text-center text-sm font-mono text-muted-foreground">
                  #{demo.presentationOrder}
                </span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  demo.status === 'COMPLETED' ? 'bg-muted text-muted-foreground' :
                  demo.status === 'PRESENTING' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' :
                  demo.status === 'QA' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' :
                  demo.status === 'ON_DECK' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' :
                  demo.status === 'SKIPPED' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {demo.status}
                </span>
                {isMyTeam && (
                  <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">Your Team</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {demo.presentationDurationMinutes}m + {demo.qaDurationMinutes}m
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
