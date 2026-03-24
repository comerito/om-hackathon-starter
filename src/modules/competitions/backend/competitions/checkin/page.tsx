"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type Competition = { id: string; name: string }
type CheckinStats = { total: number; checkedIn: number }

export default function CheckinPage() {
  const t = useT()
  const queryClient = useQueryClient()
  const [participationId, setParticipationId] = React.useState('')
  const [selectedCompetition, setSelectedCompetition] = React.useState('')
  const [checking, setChecking] = React.useState(false)
  const [lastResult, setLastResult] = React.useState<{ displayName: string; email: string; already?: boolean } | null>(null)

  // Load competitions
  const { data: comps } = useQuery({
    queryKey: ['checkin-competitions'],
    queryFn: () => fetchCrudList<Competition>('competitions/competitions', { pageSize: '50' }),
  })

  // Load check-in stats
  const { data: stats } = useQuery<CheckinStats>({
    queryKey: ['checkin-stats', selectedCompetition],
    queryFn: async () => {
      const { ok, result } = await apiCall<CheckinStats>(`/api/competitions/checkin?competition_id=${selectedCompetition}`)
      return ok && result ? result : { total: 0, checkedIn: 0 }
    },
    enabled: !!selectedCompetition,
    refetchInterval: 10000,
  })

  async function handleCheckin() {
    if (!participationId.trim()) return
    setChecking(true)
    setLastResult(null)
    try {
      const { ok, result } = await apiCall<{ ok: boolean; displayName: string; email: string; already?: boolean }>('/api/competitions/checkin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ participation_id: participationId.trim() }),
      })
      if (ok && result) {
        setLastResult(result)
        if (result.already) {
          flash(t('competitions.checkin.alreadyCheckedIn', 'Already checked in'), 'error')
        } else {
          flash(t('competitions.checkin.success', 'Checked in successfully!'), 'success')
          queryClient.invalidateQueries({ queryKey: ['checkin-stats'] })
        }
        setParticipationId('')
      } else {
        flash(t('competitions.checkin.failed', 'Check-in failed — participant not found'), 'error')
      }
    } finally {
      setChecking(false)
    }
  }

  return (
    <Page>
      <PageBody>
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold">{t('competitions.checkin.title', 'Check-In')}</h1>

          {/* Competition selector */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('competitions.checkin.selectCompetition', 'Competition')}</label>
            <select
              value={selectedCompetition}
              onChange={(e) => setSelectedCompetition(e.target.value)}
              className="h-9 w-full max-w-md rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="">{t('competitions.checkin.choose', '— Select competition —')}</option>
              {(comps?.items ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Stats */}
          {stats && (
            <div className="flex gap-6 rounded-lg border p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{stats.checkedIn}</div>
                <div className="text-xs text-muted-foreground">{t('competitions.checkin.checkedIn', 'Checked In')}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">{t('competitions.checkin.total', 'Total')}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-muted-foreground">{stats.total - stats.checkedIn}</div>
                <div className="text-xs text-muted-foreground">{t('competitions.checkin.remaining', 'Remaining')}</div>
              </div>
            </div>
          )}

          {/* Check-in input */}
          <div className="rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-3">{t('competitions.checkin.scanOrEnter', 'Scan QR or Enter Code')}</h2>
            <div className="flex gap-2">
              <Input
                type="text"
                value={participationId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setParticipationId(e.target.value)}
                placeholder={t('competitions.checkin.placeholder', 'Participation ID...')}
                className="flex-1"
                autoFocus
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleCheckin() }}
              />
              <Button onClick={handleCheckin} disabled={!participationId.trim() || checking}>
                {checking ? t('common.checking', 'Checking...') : t('competitions.checkin.checkinBtn', 'Check In')}
              </Button>
            </div>

            {/* Last result */}
            {lastResult && (
              <div className={`mt-4 p-3 rounded-md ${lastResult.already ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'} border`}>
                <p className="text-sm font-medium">{lastResult.displayName || lastResult.email}</p>
                <p className="text-xs text-muted-foreground">
                  {lastResult.already
                    ? t('competitions.checkin.alreadyNote', 'This participant was already checked in.')
                    : t('competitions.checkin.successNote', 'Successfully checked in!')}
                </p>
              </div>
            )}
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
