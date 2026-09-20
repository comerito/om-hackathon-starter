"use client"
import * as React from 'react'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  DEFAULT_THANK_YOU_PHOTOS_URL,
  THANK_YOU_EMAIL_CLIENT_CHUNK_PAUSE_MS,
  THANK_YOU_EMAIL_CLIENT_TIMEOUT_MS,
  buildThankYouEmailPayload,
  chunkParticipationIds,
  isValidPhotosUrl,
  thankYouEmailFlashKind,
  type ThankYouEmailItemResult,
} from '../lib/thankYouEmails'

const PHOTOS_URL_STORAGE_KEY = 'competitions.thankYouEmail.photosUrl'

type SendResponse = { results?: ThankYouEmailItemResult[]; error?: string }

type Phase = 'form' | 'sending' | 'done'

type Progress = {
  total: number
  sent: number
  skipped: number
  failedIds: string[]
  /** Not attempted yet — non-empty only after the operator pressed Stop. */
  pendingIds: string[]
  lastError: string | null
}

type ThankYouEmailDialogProps = {
  competitionId: string
  participationIds: string[]
  skippedAlreadySent: number
  /** `attempted` is true once a send ran, so the caller refreshes the table and clears the selection. */
  onClose: (attempted: boolean) => void
}

function readStoredPhotosUrl(): string {
  try {
    return window.localStorage.getItem(PHOTOS_URL_STORAGE_KEY) || DEFAULT_THANK_YOU_PHOTOS_URL
  } catch {
    return DEFAULT_THANK_YOU_PHOTOS_URL
  }
}

export function ThankYouEmailDialog({ competitionId, participationIds, skippedAlreadySent, onClose }: ThankYouEmailDialogProps) {
  const t = useT()
  const [photosUrl, setPhotosUrl] = React.useState('')
  const [phase, setPhase] = React.useState<Phase>('form')
  const [progress, setProgress] = React.useState<Progress | null>(null)
  const [stopping, setStopping] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const stopRequestedRef = React.useRef(false)
  const mountedRef = React.useRef(true)

  React.useEffect(() => {
    mountedRef.current = true
    setPhotosUrl(readStoredPhotosUrl())
    return () => {
      mountedRef.current = false
      stopRequestedRef.current = true
    }
  }, [])

  // One short request per chunk. A chunk whose response never arrives counts as failed and can
  // be retried safely: the server skips everyone it already marked as sent.
  async function sendChunk(ids: string[]): Promise<{ results: ThankYouEmailItemResult[]; error: string | null }> {
    const allFailed = (): ThankYouEmailItemResult[] => ids.map((id) => ({ participation_id: id, status: 'failed' }))
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), THANK_YOU_EMAIL_CLIENT_TIMEOUT_MS)
    try {
      const { result } = await apiCall<SendResponse>('/api/competitions/admin/thank-you-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildThankYouEmailPayload(competitionId, ids, photosUrl)),
        signal: controller.signal,
      })
      if (!result || !Array.isArray(result.results)) {
        return { results: allFailed(), error: result?.error ?? null }
      }
      const byId = new Map(result.results.map((item) => [item.participation_id, item]))
      return {
        results: ids.map((id) => byId.get(id) ?? { participation_id: id, status: 'failed' }),
        error: null,
      }
    } catch {
      return {
        results: allFailed(),
        error: t('competitions.participants.thankYouEmail.networkError', 'Connection problem — no response from the server.'),
      }
    } finally {
      window.clearTimeout(timer)
    }
  }

  async function runSend(ids: string[], previous: Progress | null) {
    stopRequestedRef.current = false
    setStopping(false)
    setError(null)
    setPhase('sending')

    const state: Progress = {
      total: previous?.total ?? ids.length,
      sent: previous?.sent ?? 0,
      skipped: previous?.skipped ?? 0,
      failedIds: [],
      pendingIds: [...ids],
      lastError: null,
    }
    setProgress({ ...state })

    const chunks = chunkParticipationIds(ids)
    for (const [index, chunk] of chunks.entries()) {
      if (stopRequestedRef.current) break
      if (index > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, THANK_YOU_EMAIL_CLIENT_CHUNK_PAUSE_MS))
        if (stopRequestedRef.current) break
      }
      const outcome = await sendChunk(chunk)
      if (!mountedRef.current) return
      for (const item of outcome.results) {
        if (item.status === 'sent') state.sent += 1
        else if (item.status === 'skipped') state.skipped += 1
        else state.failedIds.push(item.participation_id)
      }
      const attempted = new Set(chunk)
      state.pendingIds = state.pendingIds.filter((id) => !attempted.has(id))
      if (outcome.error) state.lastError = outcome.error
      setProgress({ ...state, failedIds: [...state.failedIds] })
    }

    if (!mountedRef.current) return
    setStopping(false)
    setPhase('done')
  }

  function handleStart() {
    if (phase !== 'form') return
    if (!isValidPhotosUrl(photosUrl)) {
      setError(t('competitions.participants.thankYouEmail.invalidUrl', 'Enter a valid link to the photos (https://…)'))
      return
    }
    try {
      window.localStorage.setItem(PHOTOS_URL_STORAGE_KEY, photosUrl.trim())
    } catch {
      // Remembering the link is a convenience only.
    }
    void runSend(participationIds, null)
  }

  function handleStop() {
    stopRequestedRef.current = true
    setStopping(true)
  }

  function handleClose() {
    if (phase === 'sending') return
    if (phase === 'done' && progress) {
      const failed = progress.failedIds.length
      const kind = thankYouEmailFlashKind({ sent: progress.sent, failed, status: failed === 0 ? 'complete' : 'partial' })
      if (kind === 'success') {
        flash(
          t('competitions.participants.thankYouEmail.flash.complete', 'Sent {count} thank-you email(s)', { count: progress.sent }),
          'success',
        )
      } else if (kind === 'warning') {
        flash(
          t('competitions.participants.thankYouEmail.flash.partial', 'Sent {sent} thank-you email(s), {failed} failed — select them again to retry', {
            sent: progress.sent,
            failed,
          }),
          'warning',
        )
      } else {
        flash(
          t('competitions.participants.thankYouEmail.flash.none', 'No thank-you emails were sent ({failed} failed)', { failed }),
          'error',
        )
      }
    }
    // Refresh whenever a send was attempted: a chunk reported as failed client-side (lost
    // response) may still have been delivered and marked on the server.
    onClose(phase === 'done')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && phase === 'form') {
      e.preventDefault()
      handleStart()
    }
    if (e.key === 'Escape') {
      if (phase === 'sending') handleStop()
      else handleClose()
    }
  }

  const retryIds = progress ? [...progress.failedIds, ...progress.pendingIds] : []
  const processed = progress ? progress.total - progress.pendingIds.length : 0
  const percent = progress && progress.total > 0 ? Math.round((processed / progress.total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3 className="text-lg font-semibold">
          {t('competitions.participants.thankYouEmail.title', 'Send thank-you email')}
        </h3>

        {phase === 'form' && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                'competitions.participants.thankYouEmail.description',
                'Thanks the selected people for taking part, congratulates the winners and invites them to find themselves in the event photos and share them on social media.',
              )}
            </p>

            <div className="mt-4 rounded-md border bg-muted/40 p-3 text-sm">
              {t('competitions.participants.thankYouEmail.recipients', '{count} recipient(s)', { count: participationIds.length })}
              {skippedAlreadySent > 0 && (
                <span className="block text-xs text-muted-foreground">
                  {t(
                    'competitions.participants.thankYouEmail.skipped',
                    '{count} selected row(s) already received it and will be skipped.',
                    { count: skippedAlreadySent },
                  )}
                </span>
              )}
            </div>

            <div className="mt-4">
              <label htmlFor="thank-you-photos-url" className="mb-1 block text-sm font-medium">
                {t('competitions.participants.thankYouEmail.photosUrl', 'Photos link')}
              </label>
              <Input
                id="thank-you-photos-url"
                type="url"
                value={photosUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhotosUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/…"
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  'competitions.participants.thankYouEmail.photosUrlHint',
                  'Make sure the folder is shared as "Anyone with the link" — otherwise recipients will hit a sign-in wall.',
                )}
              </p>
            </div>

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

            <div className="mt-5 flex items-center justify-between gap-2">
              <a
                href={`/backend/competitions/email-preview?template=thank-you${isValidPhotosUrl(photosUrl) ? `&photosUrl=${encodeURIComponent(photosUrl.trim())}` : ''}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                {t('competitions.participants.thankYouEmail.preview', 'Preview email')}
              </a>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button onClick={handleStart}>
                  {t('competitions.participants.thankYouEmail.send', 'Send emails')}
                </Button>
              </div>
            </div>
          </>
        )}

        {phase !== 'form' && progress && (
          <>
            <div className="mt-4" role="status" aria-live="polite">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">
                  {phase === 'sending'
                    ? t('competitions.participants.thankYouEmail.progress.sending', 'Sending… {processed} of {total}', {
                        processed,
                        total: progress.total,
                      })
                    : progress.pendingIds.length > 0
                      ? t('competitions.participants.thankYouEmail.progress.stopped', 'Stopped at {processed} of {total}', {
                          processed,
                          total: progress.total,
                        })
                      : t('competitions.participants.thankYouEmail.progress.finished', 'Finished')}
                </span>
                <span className="text-xs text-muted-foreground">{percent}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-md border p-2">
                <dt className="text-xs text-muted-foreground">{t('competitions.participants.thankYouEmail.progress.sent', 'Sent')}</dt>
                <dd className="text-lg font-semibold">{progress.sent}</dd>
              </div>
              <div className="rounded-md border p-2">
                <dt className="text-xs text-muted-foreground">{t('competitions.participants.thankYouEmail.progress.failed', 'Failed')}</dt>
                <dd className={`text-lg font-semibold ${progress.failedIds.length > 0 ? 'text-destructive' : ''}`}>{progress.failedIds.length}</dd>
              </div>
              <div className="rounded-md border p-2">
                <dt className="text-xs text-muted-foreground">{t('competitions.participants.thankYouEmail.progress.skipped', 'Already sent')}</dt>
                <dd className="text-lg font-semibold">{progress.skipped}</dd>
              </div>
            </dl>

            {phase === 'sending' && (
              <p className="mt-3 text-xs text-muted-foreground">
                {t(
                  'competitions.participants.thankYouEmail.progress.hint',
                  'Keep this tab open. Emails go out a few at a time; you can stop at any moment — everyone already emailed stays marked.',
                )}
              </p>
            )}
            {phase === 'done' && progress.failedIds.length > 0 && (
              <p className="mt-3 text-sm text-destructive">
                {progress.lastError
                  ?? t('competitions.participants.thankYouEmail.progress.failedHint', 'Some emails could not be sent. Retrying is safe — nobody gets it twice.')}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              {phase === 'sending' ? (
                <Button variant="outline" onClick={handleStop} disabled={stopping}>
                  {stopping
                    ? t('competitions.participants.thankYouEmail.stopping', 'Stopping…')
                    : t('competitions.participants.thankYouEmail.stop', 'Stop')}
                </Button>
              ) : (
                <>
                  {retryIds.length > 0 && (
                    <Button variant="outline" onClick={() => void runSend(retryIds, progress)}>
                      {t('competitions.participants.thankYouEmail.retry', 'Retry / resume ({count})', { count: retryIds.length })}
                    </Button>
                  )}
                  <Button onClick={handleClose}>{t('competitions.participants.thankYouEmail.close', 'Close')}</Button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
