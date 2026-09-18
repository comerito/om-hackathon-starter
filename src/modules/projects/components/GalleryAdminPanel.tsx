"use client"
import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { Button } from '@open-mercato/ui/primitives/button'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { GALLERY_SUMMARY_MAX_LENGTH } from '../lib/gallery/render'

/* Backoffice review + publish panel for the Open Mercato Project Gallery (SPEC-008). */

type GalleryStatus = 'not_requested' | 'requested' | 'pr_open' | 'published' | 'rejected'

type GalleryAdminState = {
  gallery: {
    publish_to_gallery: boolean
    summary: string | null
    built_on_open_mercato: string | null
    screenshots: Array<{ attachment_id: string; alt: string }>
    poster_attachment_id: string | null
    show_team_members: boolean
    consent_accepted: boolean
    status: GalleryStatus
    pr_url: string | null
    live_url: string | null
    rejected_reason: string | null
    slug: string | null
  }
  project_status: string
  configured: boolean
  repo: string | null
  site_url: string
  preview: {
    slug: string
    errors: string[]
    markdown_path: string | null
    markdown: string | null
    assets: Array<{ path: string; attachment_id: string; file_name: string | null }>
  }
}

type ActionResult = { ok?: boolean; error?: string; details?: string[]; pr_url?: string; pr_close_failed?: boolean }

const STATUS_VARIANT: Record<GalleryStatus, 'secondary' | 'outline' | 'default' | 'destructive'> = {
  not_requested: 'outline',
  requested: 'secondary',
  pr_open: 'secondary',
  published: 'default',
  rejected: 'destructive',
}

function errorMessage(result: ActionResult | null | undefined, fallback: string): string {
  if (result?.details?.length) return `${result.error ?? fallback}: ${result.details.join('; ')}`
  return result?.error ?? fallback
}

export function GalleryAdminPanel({ projectId }: { projectId: string }) {
  const t = useT()
  const [state, setState] = React.useState<GalleryAdminState | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<null | 'save' | 'publish' | 'refresh' | 'reject'>(null)
  const [showPreview, setShowPreview] = React.useState(false)
  const [rejecting, setRejecting] = React.useState(false)
  const [rejectReason, setRejectReason] = React.useState('')

  // Editable copy
  const [optedIn, setOptedIn] = React.useState(false)
  const [summary, setSummary] = React.useState('')
  const [builtOn, setBuiltOn] = React.useState('')
  const [alts, setAlts] = React.useState<Record<string, string>>({})

  const load = React.useCallback(async () => {
    const { ok, result } = await apiCall<GalleryAdminState & { error?: string }>(
      `/api/projects/admin/gallery?project_id=${encodeURIComponent(projectId)}`,
    )
    if (!ok || !result?.gallery) {
      setLoadError(result?.error ?? t('projects.galleryAdmin.loadFailed', 'Could not load gallery data'))
      return
    }
    setLoadError(null)
    setState(result)
    setOptedIn(result.gallery.publish_to_gallery)
    setSummary(result.gallery.summary ?? '')
    setBuiltOn(result.gallery.built_on_open_mercato ?? '')
    setAlts(Object.fromEntries(result.gallery.screenshots.map((s) => [s.attachment_id, s.alt])))
  }, [projectId, t])

  React.useEffect(() => { void load() }, [load])

  async function runAction(kind: 'publish' | 'refresh' | 'reject', body: Record<string, unknown>, successMessage: string) {
    setBusy(kind)
    try {
      const { ok, result } = await apiCall<ActionResult>(`/api/projects/admin/gallery/${kind}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, ...body }),
      })
      if (!ok) {
        flash(errorMessage(result, t('projects.galleryAdmin.actionFailed', 'Gallery action failed')), 'error')
        return false
      }
      flash(successMessage, 'success')
      if (result?.pr_close_failed) {
        flash(t('projects.galleryAdmin.prCloseFailed', 'Marked as not accepted, but the pull request could not be closed. Close it on GitHub.'), 'warning')
      }
      await load()
      return true
    } finally {
      setBusy(null)
    }
  }

  async function handleSave() {
    if (!state) return
    setBusy('save')
    try {
      const { ok, result } = await apiCall<ActionResult>('/api/projects/admin/gallery', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          publish_to_gallery: optedIn,
          summary: summary.trim() || null,
          built_on_open_mercato: builtOn.trim() || null,
          screenshots: state.gallery.screenshots.map((s) => ({ attachment_id: s.attachment_id, alt: alts[s.attachment_id] ?? s.alt })),
        }),
      })
      if (!ok) {
        flash(errorMessage(result, t('projects.galleryAdmin.saveFailed', 'Could not save gallery copy')), 'error')
        return
      }
      flash(t('projects.galleryAdmin.saved', 'Gallery copy saved'), 'success')
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return
    const done = await runAction('reject', { reason: rejectReason.trim() }, t('projects.galleryAdmin.rejected', 'Gallery request marked as not accepted'))
    if (done) {
      setRejecting(false)
      setRejectReason('')
    }
  }

  if (loadError) {
    return <div className="mt-6 rounded-lg border bg-card p-4 text-sm text-red-600">{loadError}</div>
  }
  if (!state) return null

  const { gallery, preview } = state
  const statusLabels: Record<GalleryStatus, string> = {
    not_requested: t('projects.galleryAdmin.status.notRequested', 'Not requested'),
    requested: t('projects.galleryAdmin.status.requested', 'Requested by team'),
    pr_open: t('projects.galleryAdmin.status.prOpen', 'Pull request open'),
    published: t('projects.galleryAdmin.status.published', 'Live'),
    rejected: t('projects.galleryAdmin.status.rejected', 'Not accepted'),
  }
  const isDraft = state.project_status === 'draft'
  const isLive = gallery.status === 'published'
  const canPublish = gallery.publish_to_gallery && !isDraft && !isLive && state.configured && preview.errors.length === 0

  return (
    <div className="mt-6 rounded-lg border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{t('projects.galleryAdmin.title', 'Open Mercato Project Gallery')}</h3>
          <a href={state.site_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
            {state.site_url}
          </a>
        </div>
        <Badge variant={STATUS_VARIANT[gallery.status]}>{statusLabels[gallery.status]}</Badge>
      </div>

      {!gallery.publish_to_gallery && gallery.status === 'not_requested' ? (
        <p className="text-sm text-muted-foreground">
          {t('projects.galleryAdmin.notOptedIn', 'The team did not ask for this project to be published in the gallery.')}
        </p>
      ) : (
        <>
          {(gallery.pr_url || gallery.live_url) && (
            <div className="flex flex-wrap gap-4 text-sm">
              {gallery.pr_url && (
                <a href={gallery.pr_url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                  {t('projects.galleryAdmin.viewPr', 'View pull request')}
                </a>
              )}
              {gallery.live_url && (
                <a href={gallery.live_url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                  {t('projects.galleryAdmin.viewLive', 'View live page')}
                </a>
              )}
            </div>
          )}
          {gallery.status === 'rejected' && gallery.rejected_reason && (
            <p className="text-sm text-muted-foreground">{gallery.rejected_reason}</p>
          )}

          {/* Copy polish */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="gallery-opt-in" checked={optedIn} onCheckedChange={(checked) => setOptedIn(checked === true)} disabled={isLive} />
              <Label htmlFor="gallery-opt-in">{t('projects.galleryAdmin.optIn', 'Team opted in to the gallery')}</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {gallery.consent_accepted
                ? t('projects.galleryAdmin.consentGiven', 'Publication consent given by the team.')
                : t('projects.galleryAdmin.consentMissing', 'The team has not confirmed publication consent. Only the team can give it, from the portal.')}
              {' '}
              {gallery.show_team_members
                ? t('projects.galleryAdmin.teamShown', 'Team member names will be shown.')
                : t('projects.galleryAdmin.teamHidden', 'Team member names stay hidden.')}
            </p>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="gallery-summary">{t('projects.galleryAdmin.summary', 'Gallery summary')}</Label>
                <span className="text-xs text-muted-foreground">{summary.trim().length}/{GALLERY_SUMMARY_MAX_LENGTH}</span>
              </div>
              <Textarea id="gallery-summary" value={summary} maxLength={GALLERY_SUMMARY_MAX_LENGTH} onChange={(e) => setSummary(e.target.value)} disabled={isLive} />
            </div>
            <div>
              <Label htmlFor="gallery-built-on">{t('projects.galleryAdmin.builtOn', 'Built on Open Mercato')}</Label>
              <Textarea id="gallery-built-on" value={builtOn} onChange={(e) => setBuiltOn(e.target.value)} disabled={isLive} />
            </div>
            {gallery.screenshots.map((screenshot, idx) => (
              <div key={screenshot.attachment_id}>
                <Label htmlFor={`gallery-alt-${idx}`}>
                  {t('projects.galleryAdmin.alt', 'Screenshot {n} description', { n: idx + 1 })}
                  {gallery.poster_attachment_id === screenshot.attachment_id ? ` (${t('projects.galleryAdmin.poster', 'poster')})` : ''}
                </Label>
                <Input
                  id={`gallery-alt-${idx}`}
                  value={alts[screenshot.attachment_id] ?? ''}
                  maxLength={300}
                  onChange={(e) => setAlts((current) => ({ ...current, [screenshot.attachment_id]: e.target.value }))}
                  disabled={isLive}
                />
              </div>
            ))}
            {!isLive && (
              <Button size="sm" variant="outline" onClick={handleSave} disabled={busy !== null}>
                {busy === 'save' ? t('projects.galleryAdmin.saving', 'Saving...') : t('projects.galleryAdmin.save', 'Save gallery copy')}
              </Button>
            )}
          </div>

          {/* Readiness */}
          {!isLive && (preview.errors.length > 0 || isDraft || !state.configured) && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">{t('projects.galleryAdmin.notReady', 'Not ready to publish')}</p>
              <ul className="mt-1 list-disc pl-5">
                {isDraft && <li>{t('projects.galleryAdmin.stillDraft', 'The project has not been submitted yet')}</li>}
                {!state.configured && <li>{t('projects.galleryAdmin.notConfigured', 'GALLERY_GITHUB_TOKEN is not set on the server, so pull requests cannot be opened')}</li>}
                {preview.errors.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            </div>
          )}

          {/* Preview */}
          {preview.markdown && (
            <div>
              <Button size="sm" variant="ghost" onClick={() => setShowPreview((open) => !open)}>
                {showPreview ? t('projects.galleryAdmin.hidePreview', 'Hide preview') : t('projects.galleryAdmin.showPreview', 'Preview gallery file')}
              </Button>
              {showPreview && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-muted-foreground font-mono">{state.repo ?? 'open-mercato/project-gallery'} / {preview.markdown_path}</p>
                  <pre className="max-h-96 overflow-auto rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap">{preview.markdown}</pre>
                  <ul className="text-xs text-muted-foreground font-mono space-y-0.5">
                    {preview.assets.map((asset) => (
                      <li key={asset.path}>{asset.path} ← {asset.file_name ?? asset.attachment_id}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {!isLive && (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button
                size="sm"
                onClick={() => runAction('publish', {}, t('projects.galleryAdmin.published', 'Pull request is up on the gallery repository'))}
                disabled={!canPublish || busy !== null}
              >
                {busy === 'publish'
                  ? t('projects.galleryAdmin.publishing', 'Publishing...')
                  : gallery.status === 'pr_open'
                    ? t('projects.galleryAdmin.updatePr', 'Update pull request')
                    : t('projects.galleryAdmin.publish', 'Publish to gallery')}
              </Button>
              {gallery.pr_url && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runAction('refresh', {}, t('projects.galleryAdmin.refreshed', 'Gallery status refreshed'))}
                  disabled={busy !== null || !state.configured}
                >
                  {busy === 'refresh' ? t('projects.galleryAdmin.refreshing', 'Refreshing...') : t('projects.galleryAdmin.refresh', 'Refresh status')}
                </Button>
              )}
              {gallery.publish_to_gallery && gallery.status !== 'rejected' && !rejecting && (
                <Button size="sm" variant="destructive" onClick={() => setRejecting(true)} disabled={busy !== null}>
                  {t('projects.galleryAdmin.reject', 'Do not publish')}
                </Button>
              )}
            </div>
          )}

          {rejecting && (
            <div
              className="space-y-2 rounded-md border p-3"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setRejecting(false)
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleReject()
              }}
            >
              <Label htmlFor="gallery-reject-reason">{t('projects.galleryAdmin.rejectReason', 'Reason (shown to the team)')}</Label>
              <Textarea id="gallery-reject-reason" autoFocus value={rejectReason} maxLength={1000} onChange={(e) => setRejectReason(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={handleReject} disabled={!rejectReason.trim() || busy !== null}>
                  {t('projects.galleryAdmin.confirmReject', 'Confirm')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
                  {t('projects.galleryAdmin.cancel', 'Cancel')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
