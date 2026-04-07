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
import { Keyboard, Camera, Mail } from 'lucide-react'

type Competition = { id: string; name: string }
type CheckinStats = { total: number; checkedIn: number }
type CheckinResult = { ok: boolean; displayName: string; email: string; already?: boolean }
type CheckinMode = 'code' | 'camera' | 'email'

function QrScanner({ onScan, onError }: { onScan: (value: string) => void; onError?: (err: string) => void }) {
  const scannerRef = React.useRef<HTMLDivElement>(null)
  const html5QrRef = React.useRef<any>(null)
  const t = useT()

  React.useEffect(() => {
    let mounted = true
    async function start() {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (!mounted || !scannerRef.current) return
      const scanner = new Html5Qrcode(scannerRef.current.id)
      html5QrRef.current = scanner
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            onScan(decodedText)
          },
          () => {},
        )
      } catch (err: any) {
        onError?.(err?.message ?? 'Camera access denied')
      }
    }
    start()
    return () => {
      mounted = false
      const scanner = html5QrRef.current
      if (scanner) {
        scanner.stop().then(() => scanner.clear()).catch(() => {
          try { scanner.clear() } catch (_) { /* already cleared */ }
        })
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        id="checkin-qr-reader"
        ref={scannerRef}
        className="w-full max-w-sm rounded-lg overflow-hidden"
      />
      <p className="text-xs text-muted-foreground">
        {t('competitions.checkin.cameraHint', 'Point the camera at a participant QR code')}
      </p>
    </div>
  )
}

export default function CheckinPage() {
  const t = useT()
  const queryClient = useQueryClient()
  const [participationId, setParticipationId] = React.useState('')
  const [emailSearch, setEmailSearch] = React.useState('')
  const [selectedCompetition, setSelectedCompetition] = React.useState('')
  const [checking, setChecking] = React.useState(false)
  const [lastResult, setLastResult] = React.useState<{ displayName: string; email: string; already?: boolean } | null>(null)
  const [mode, setMode] = React.useState<CheckinMode>('code')
  const [cameraError, setCameraError] = React.useState<string | null>(null)

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

  async function checkinById(id: string) {
    if (!id.trim()) return
    setChecking(true)
    setLastResult(null)
    try {
      const { ok, result } = await apiCall<CheckinResult>('/api/competitions/checkin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ participation_id: id.trim() }),
      })
      handleCheckinResponse(ok, result)
    } finally {
      setChecking(false)
    }
  }

  async function checkinByEmail() {
    if (!emailSearch.trim() || !selectedCompetition) return
    setChecking(true)
    setLastResult(null)
    try {
      const { ok, result } = await apiCall<CheckinResult>('/api/competitions/checkin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: emailSearch.trim(), competition_id: selectedCompetition }),
      })
      handleCheckinResponse(ok, result)
      if (ok && result) setEmailSearch('')
    } finally {
      setChecking(false)
    }
  }

  function handleCheckinResponse(ok: boolean, result: CheckinResult | null | undefined) {
    if (ok && result) {
      setLastResult(result)
      if (result.already) {
        flash(t('competitions.checkin.alreadyCheckedIn', 'Already checked in'), 'error')
      } else {
        flash(t('competitions.checkin.success', 'Checked in successfully!'), 'success')
        queryClient.invalidateQueries({ queryKey: ['checkin-stats'] })
      }
    } else {
      flash(t('competitions.checkin.failed', 'Check-in failed — participant not found'), 'error')
    }
  }

  function handleQrScan(decodedText: string) {
    // QR format: hackon:checkin:{participation_id}
    const match = decodedText.match(/^hackon:checkin:(.+)$/)
    const id = match ? match[1] : decodedText.trim()
    if (id) {
      setParticipationId(id)
      setMode('code')
      checkinById(id)
    }
  }

  function handleCheckin() {
    checkinById(participationId)
    setParticipationId('')
  }

  const modes: { key: CheckinMode; label: string; icon: React.ReactNode }[] = [
    { key: 'code', label: t('competitions.checkin.modeCode', 'Code'), icon: <Keyboard className="size-4" /> },
    { key: 'camera', label: t('competitions.checkin.modeCamera', 'Camera'), icon: <Camera className="size-4" /> },
    { key: 'email', label: t('competitions.checkin.modeEmail', 'Email'), icon: <Mail className="size-4" /> },
  ]

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

          {/* Check-in modes */}
          <div className="rounded-lg border p-6">
            {/* Mode tabs */}
            <div className="flex gap-1 mb-4 rounded-lg bg-muted p-1">
              {modes.map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => { setMode(m.key); setCameraError(null); setLastResult(null) }}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    mode === m.key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>

            {/* Code mode */}
            {mode === 'code' && (
              <>
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
              </>
            )}

            {/* Camera mode */}
            {mode === 'camera' && (
              <>
                <h2 className="text-lg font-semibold mb-3">{t('competitions.checkin.scanQR', 'Scan QR Code')}</h2>
                {cameraError ? (
                  <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                    <p className="font-medium">{t('competitions.checkin.cameraError', 'Camera not available')}</p>
                    <p className="mt-1 text-xs">{cameraError}</p>
                    <Button
                      variant="outline"
                      className="mt-3"
                      onClick={() => { setMode('code'); setCameraError(null) }}
                      type="button"
                    >
                      {t('competitions.checkin.switchToManual', 'Enter code manually')}
                    </Button>
                  </div>
                ) : (
                  <QrScanner
                    onScan={handleQrScan}
                    onError={(err) => setCameraError(err)}
                  />
                )}
              </>
            )}

            {/* Email mode */}
            {mode === 'email' && (
              <>
                <h2 className="text-lg font-semibold mb-3">{t('competitions.checkin.searchByEmail', 'Check In by Email')}</h2>
                {!selectedCompetition ? (
                  <p className="text-sm text-muted-foreground">
                    {t('competitions.checkin.selectCompetitionFirst', 'Select a competition first to search by email.')}
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={emailSearch}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmailSearch(e.target.value)}
                      placeholder={t('competitions.checkin.emailPlaceholder', 'participant@email.com')}
                      className="flex-1"
                      autoFocus
                      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') checkinByEmail() }}
                    />
                    <Button onClick={checkinByEmail} disabled={!emailSearch.trim() || checking}>
                      {checking ? t('common.checking', 'Checking...') : t('competitions.checkin.checkinBtn', 'Check In')}
                    </Button>
                  </div>
                )}
              </>
            )}

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
