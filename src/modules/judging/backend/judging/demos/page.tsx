'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@open-mercato/ui/primitives/button'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useSearchParams } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DemoSessionRow = {
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
  actualEnd: string | null
  round: string
}

type CurrentDemoResponse = {
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
    id: string
    teamName: string | null
    projectTitle: string | null
    presentationOrder: number
  } | null
  serverTime: string
}

// Status colors
const STATUS_COLORS: Record<string, string> = {
  QUEUED: 'bg-muted text-muted-foreground',
  ON_DECK: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
  PRESENTING: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  QA: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  COMPLETED: 'bg-muted/50 text-muted-foreground',
  SKIPPED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
}

// ---------------------------------------------------------------------------
// Timer component
// ---------------------------------------------------------------------------

function DemoTimer({ startTime, durationMinutes }: { startTime: string | null; durationMinutes: number }) {
  const [elapsed, setElapsed] = React.useState(0)

  React.useEffect(() => {
    if (!startTime) return
    const start = new Date(startTime).getTime()
    function tick() {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startTime])

  if (!startTime) return <span className="text-muted-foreground">--:--</span>

  const totalSeconds = durationMinutes * 60
  const remaining = Math.max(0, totalSeconds - elapsed)
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const isOvertime = elapsed > totalSeconds

  return (
    <span className={`font-mono text-3xl font-bold ${isOvertime ? 'text-destructive animate-pulse' : 'text-primary'}`}>
      {isOvertime ? '-' : ''}{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DemoControlPage() {
  const t = useT()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const searchParams = useSearchParams()
  const competitionId = searchParams.get('competitionId') ?? ''
  const scopeVersion = useOrganizationScopeVersion()
  const [isAdvancing, setIsAdvancing] = React.useState(false)
  const [isGenerating, setIsGenerating] = React.useState(false)

  // Demo list
  const { data: demoData, isLoading: demosLoading } = useQuery<{ items: DemoSessionRow[]; total: number }>({
    queryKey: ['demo-sessions', competitionId, scopeVersion],
    queryFn: () => apiCall(`/api/judging/demos?competitionId=${competitionId}&pageSize=100&sortField=presentation_order&sortDir=asc`),
    enabled: !!competitionId,
    refetchInterval: 5000,
  })

  // Current demo
  const { data: currentData } = useQuery<CurrentDemoResponse>({
    queryKey: ['current-demo', competitionId, scopeVersion],
    queryFn: () => apiCall(`/api/judging/demos/current?competitionId=${competitionId}`),
    enabled: !!competitionId,
    refetchInterval: 2000,
  })

  const demos = demoData?.items ?? []
  const current = currentData?.current
  const onDeck = currentData?.onDeck

  // Total time estimate
  const totalMinutes = demos.reduce((sum, d) => {
    if (d.status === 'COMPLETED' || d.status === 'SKIPPED') return sum
    return sum + d.presentationDurationMinutes + d.qaDurationMinutes
  }, 0)

  const handleAdvance = async (demoId: string) => {
    setIsAdvancing(true)
    try {
      await apiCall('/api/judging/demos/advance', { method: 'POST', body: JSON.stringify({ demoId }) })
      flash(t('judging.demos.flash.advanced', 'Demo advanced'), 'success')
      queryClient.invalidateQueries({ queryKey: ['demo-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['current-demo'] })
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to advance demo', 'error')
    } finally {
      setIsAdvancing(false)
    }
  }

  const handleSkip = async (demoId: string) => {
    const confirmed = await confirm({
      title: t('judging.demos.confirm.skip', 'Skip this demo?'),
      variant: 'destructive',
    })
    if (!confirmed) return
    try {
      await apiCall('/api/judging/demos/skip', { method: 'POST', body: JSON.stringify({ demoId }) })
      flash(t('judging.demos.flash.skipped', 'Demo skipped'), 'success')
      queryClient.invalidateQueries({ queryKey: ['demo-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['current-demo'] })
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to skip demo', 'error')
    }
  }

  const handleGenerateQueue = async () => {
    const confirmed = await confirm({
      title: t('judging.demos.confirm.generate', 'Generate demo queue? This will replace the existing queue.'),
    })
    if (!confirmed) return
    setIsGenerating(true)
    try {
      await apiCall('/api/judging/demos', {
        method: 'POST',
        body: JSON.stringify({ competitionId, round: 'PRELIMINARY' }),
      })
      flash(t('judging.demos.flash.generated', 'Demo queue generated'), 'success')
      queryClient.invalidateQueries({ queryKey: ['demo-sessions'] })
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to generate queue', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!competitionId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">{t('judging.demos.title', 'Demo Control')}</h1>
        <p className="text-muted-foreground mt-2">{t('judging.demos.noCompetition', 'Select a competition to manage demos.')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('judging.demos.title', 'Demo Control')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGenerateQueue} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : t('judging.demos.actions.generate', 'Generate Queue')}
          </Button>
        </div>
      </div>

      {/* Current presenting */}
      {current && (
        <div className="rounded-lg border-2 border-primary bg-primary/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {current.status === 'QA' ? 'Q&A' : current.status === 'PRESENTING' ? 'Now Presenting' : 'On Deck'} — #{current.presentationOrder}
              </p>
              <h2 className="text-xl font-bold mt-1">{current.teamName ?? 'Unknown Team'}</h2>
              <p className="text-muted-foreground">{current.projectTitle ?? 'Untitled Project'}</p>
            </div>
            <div className="text-right">
              <DemoTimer
                startTime={current.actualStart}
                durationMinutes={current.status === 'QA' ? current.qaDurationMinutes : current.presentationDurationMinutes}
              />
              <div className="mt-2 flex gap-2 justify-end">
                <Button
                  size="sm"
                  onClick={() => handleAdvance(current.id)}
                  disabled={isAdvancing}
                >
                  {t('judging.demos.actions.advance', 'Advance')}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleSkip(current.id)}
                >
                  {t('judging.demos.actions.skip', 'Skip')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* On deck */}
      {onDeck && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-900/20 p-4">
          <p className="text-sm text-muted-foreground">On Deck — #{onDeck.presentationOrder}</p>
          <p className="font-medium">{onDeck.teamName ?? 'Unknown Team'} — {onDeck.projectTitle ?? 'Untitled'}</p>
        </div>
      )}

      {/* Time estimate */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{demos.length} total demos</span>
        <span>{demos.filter(d => d.status === 'COMPLETED').length} completed</span>
        <span>~{totalMinutes} min remaining</span>
      </div>

      {/* Queue list */}
      {demosLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-2">
          {demos.map((demo) => (
            <div
              key={demo.id}
              className={`flex items-center justify-between rounded-lg border p-3 ${
                current?.id === demo.id ? 'ring-2 ring-primary' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-8 text-center text-sm font-mono text-muted-foreground">
                  #{demo.presentationOrder}
                </span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[demo.status] ?? ''}`}>
                  {demo.status}
                </span>
                <span className="text-sm">{demo.teamId.slice(0, 8)}...</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {demo.presentationDurationMinutes}m + {demo.qaDurationMinutes}m Q&A
                </span>
                {['QUEUED', 'ON_DECK'].includes(demo.status) && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => handleAdvance(demo.id)} disabled={isAdvancing}>
                      Advance
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleSkip(demo.id)}>
                      Skip
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {ConfirmDialogElement}
    </div>
  )
}
