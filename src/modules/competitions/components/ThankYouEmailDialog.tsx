"use client"
import * as React from 'react'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  DEFAULT_THANK_YOU_PHOTOS_URL,
  THANK_YOU_EMAIL_MAX_RECIPIENTS,
  buildThankYouEmailPayload,
  isValidPhotosUrl,
  thankYouEmailFlashKind,
  type ThankYouEmailSummary,
} from '../lib/thankYouEmails'

const PHOTOS_URL_STORAGE_KEY = 'competitions.thankYouEmail.photosUrl'

type SendResponse = Partial<ThankYouEmailSummary> & { error?: string }

type ThankYouEmailDialogProps = {
  competitionId: string
  participationIds: string[]
  skippedAlreadySent: number
  /** `sent` is true when at least one email went out, so the caller can refresh and clear the selection. */
  onClose: (sent: boolean) => void
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
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setPhotosUrl(readStoredPhotosUrl())
  }, [])

  async function handleSend() {
    if (sending) return
    if (!isValidPhotosUrl(photosUrl)) {
      setError(t('competitions.participants.thankYouEmail.invalidUrl', 'Enter a valid link to the photos (https://…)'))
      return
    }

    if (participationIds.length > THANK_YOU_EMAIL_MAX_RECIPIENTS) {
      setError(
        t('competitions.participants.thankYouEmail.tooMany', 'Select at most {max} recipients per send.', {
          max: THANK_YOU_EMAIL_MAX_RECIPIENTS,
        }),
      )
      return
    }

    setError(null)
    setSending(true)
    try {
      window.localStorage.setItem(PHOTOS_URL_STORAGE_KEY, photosUrl.trim())
    } catch {
      // Remembering the link is a convenience only.
    }

    const { ok, result } = await apiCall<SendResponse>('/api/competitions/admin/thank-you-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildThankYouEmailPayload(competitionId, participationIds, photosUrl)),
    })
    setSending(false)

    if (!ok || !result || typeof result.sent !== 'number') {
      setError(result?.error || t('competitions.participants.thankYouEmail.error', 'Failed to send the thank-you emails'))
      return
    }

    const summary: ThankYouEmailSummary = {
      sent: result.sent,
      failed: result.failed ?? 0,
      status: result.status ?? 'partial',
    }
    const kind = thankYouEmailFlashKind(summary)
    if (kind === 'success') {
      flash(
        t('competitions.participants.thankYouEmail.flash.complete', 'Sent {count} thank-you email(s)', { count: summary.sent }),
        'success',
      )
    } else if (kind === 'warning') {
      flash(
        t('competitions.participants.thankYouEmail.flash.partial', 'Sent {sent} thank-you email(s), {failed} failed — select them again to retry', {
          sent: summary.sent,
          failed: summary.failed,
        }),
        'warning',
      )
    } else {
      flash(
        t('competitions.participants.thankYouEmail.flash.none', 'No thank-you emails were sent ({failed} failed)', { failed: summary.failed }),
        'error',
      )
    }
    onClose(summary.sent > 0)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleSend()
    }
    if (e.key === 'Escape' && !sending) {
      onClose(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => { if (!sending) onClose(false) }}
    >
      <div
        className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3 className="text-lg font-semibold">
          {t('competitions.participants.thankYouEmail.title', 'Send thank-you email')}
        </h3>
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
            disabled={sending}
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
            <Button variant="outline" onClick={() => onClose(false)} disabled={sending}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={() => void handleSend()} disabled={sending}>
              {sending
                ? t('competitions.participants.thankYouEmail.sending', 'Sending…')
                : t('competitions.participants.thankYouEmail.send', 'Send emails')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
