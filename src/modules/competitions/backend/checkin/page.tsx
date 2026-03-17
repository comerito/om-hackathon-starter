"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useSearchParams } from 'next/navigation'

type ParticipationRow = {
  id: string
  competition_id: string
  customer_user_id: string
  role: string
  checked_in: boolean
}

type ParticipationsResponse = {
  items: ParticipationRow[]
  total: number
}

export default function CheckinPage() {
  const t = useT()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const competitionId = searchParams.get('competitionId') ?? ''
  const scopeVersion = useOrganizationScopeVersion()

  const [searchInput, setSearchInput] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [lastResult, setLastResult] = React.useState<{ success: boolean; message: string } | null>(null)

  // Live check-in count
  const { data: countData, refetch: refetchCount } = useQuery<ParticipationsResponse>({
    queryKey: ['checkin-count', competitionId, scopeVersion],
    queryFn: async () => {
      const params: Record<string, string> = { pageSize: '1', checkedIn: 'true' }
      if (competitionId) params.competitionId = competitionId
      return fetchCrudList<ParticipationRow>('competitions/participations', params)
    },
    refetchInterval: 10000,
  })

  const { data: totalData } = useQuery<ParticipationsResponse>({
    queryKey: ['checkin-total', competitionId, scopeVersion],
    queryFn: async () => {
      const params: Record<string, string> = { pageSize: '1' }
      if (competitionId) params.competitionId = competitionId
      return fetchCrudList<ParticipationRow>('competitions/participations', params)
    },
  })

  const handleCheckin = React.useCallback(async () => {
    const value = searchInput.trim()
    if (!value) return

    setLoading(true)
    setLastResult(null)

    try {
      // Try direct participation ID first
      await apiCall('/api/competitions/participations/checkin', {
        method: 'POST',
        body: JSON.stringify({ participationId: value }),
      })
      setLastResult({
        success: true,
        message: t('competitions.checkin.success', 'Participant checked in successfully!'),
      })
      setSearchInput('')
      refetchCount()
      queryClient.invalidateQueries({ queryKey: ['participations'] })
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : t('competitions.checkin.error.generic', 'Failed to check in. Please verify the ID and try again.')
      setLastResult({ success: false, message })
    } finally {
      setLoading(false)
    }
  }, [searchInput, t, refetchCount, queryClient])

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleCheckin()
    }
  }, [handleCheckin])

  const checkedInCount = countData?.total ?? 0
  const totalCount = totalData?.total ?? 0

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-bold">
          {t('competitions.checkin.title', 'Check-In Scanner')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('competitions.checkin.description', 'Enter a participation ID or search by email to check in a participant.')}
        </p>
      </div>

      {/* Live count */}
      <div className="flex items-center gap-4 rounded-lg border bg-card p-6">
        <div className="flex flex-col">
          <span className="text-sm text-muted-foreground">
            {t('competitions.checkin.count.label', 'Checked In')}
          </span>
          <span className="text-4xl font-bold tracking-tight text-primary">
            {checkedInCount}
            <span className="text-lg text-muted-foreground"> / {totalCount}</span>
          </span>
        </div>
        <div className="ml-auto">
          <div
            className="h-3 w-32 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: totalCount > 0 ? `${Math.round((checkedInCount / totalCount) * 100)}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {/* Search + Check in */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder={t('competitions.checkin.input.placeholder', 'Participation ID or email...')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 rounded-md border bg-background px-4 py-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            autoFocus
          />
          <Button
            onClick={handleCheckin}
            disabled={loading || !searchInput.trim()}
            size="lg"
          >
            {loading
              ? t('competitions.checkin.button.loading', 'Checking in...')
              : t('competitions.checkin.button.submit', 'Check In')
            }
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t('competitions.checkin.hint', 'Press Cmd/Ctrl+Enter to submit')}
        </p>
      </div>

      {/* Result feedback */}
      {lastResult && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            lastResult.success
              ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
          }`}
        >
          {lastResult.message}
        </div>
      )}
    </div>
  )
}
