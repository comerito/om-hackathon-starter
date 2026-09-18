"use client"
import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { ExternalLink, Globe } from 'lucide-react'
import {
  GALLERY_MAX_IMAGE_BYTES,
  GALLERY_MAX_SCREENSHOTS,
  GALLERY_MIN_SCREENSHOTS,
  GALLERY_SUMMARY_MAX_LENGTH,
  galleryImageExtension,
} from '../lib/gallery/render'
import { parseGalleryVideoUrl } from '../lib/gallery/video'

/* Opt-in section for the Open Mercato Project Gallery (SPEC-008). */

export type GalleryFormValue = {
  publish_to_gallery: boolean
  summary: string
  built_on_open_mercato: string
  screenshots: Array<{ attachment_id: string; alt: string }>
  poster_attachment_id: string | null
  show_team_members: boolean
  consent_accepted: boolean
}

export type GalleryServerState = Omit<GalleryFormValue, 'summary' | 'built_on_open_mercato'> & {
  summary: string | null
  built_on_open_mercato: string | null
  status: 'not_requested' | 'requested' | 'pr_open' | 'published' | 'rejected'
  pr_url: string | null
  live_url: string | null
  rejected_reason: string | null
}

export type GalleryScreenshotOption = { id: string; url: string; mime_type: string; file_size: number }

export const EMPTY_GALLERY_FORM: GalleryFormValue = {
  publish_to_gallery: false,
  summary: '',
  built_on_open_mercato: '',
  screenshots: [],
  poster_attachment_id: null,
  show_team_members: false,
  consent_accepted: false,
}

export function galleryFormFromServer(gallery: GalleryServerState | null | undefined): GalleryFormValue {
  if (!gallery) return EMPTY_GALLERY_FORM
  return {
    publish_to_gallery: gallery.publish_to_gallery,
    summary: gallery.summary ?? '',
    built_on_open_mercato: gallery.built_on_open_mercato ?? '',
    screenshots: gallery.screenshots ?? [],
    poster_attachment_id: gallery.poster_attachment_id ?? null,
    show_team_members: gallery.show_team_members,
    consent_accepted: gallery.consent_accepted,
  }
}

/** The `gallery` object `PUT /api/projects/portal/update-project` expects. */
export function galleryFormToPayload(value: GalleryFormValue) {
  return {
    publish_to_gallery: value.publish_to_gallery,
    summary: value.summary.trim() || null,
    built_on_open_mercato: value.built_on_open_mercato.trim() || null,
    screenshots: value.screenshots.map((s) => ({ attachment_id: s.attachment_id, alt: s.alt.trim() })),
    poster_attachment_id: value.poster_attachment_id,
    show_team_members: value.show_team_members,
    consent_accepted: value.consent_accepted,
  }
}

/** Drop picks whose screenshot was removed from the project. */
export function pruneGalleryScreenshots(value: GalleryFormValue, screenshotIds: readonly string[]): GalleryFormValue {
  const screenshots = value.screenshots.filter((s) => screenshotIds.includes(s.attachment_id))
  if (screenshots.length === value.screenshots.length) return value
  const posterStillPicked = screenshots.some((s) => s.attachment_id === value.poster_attachment_id)
  return { ...value, screenshots, poster_attachment_id: posterStillPicked ? value.poster_attachment_id : null }
}

type Translate = ReturnType<typeof useT>

/** Extra submission-checklist rows; empty unless the team opted in. Mirrors `collectGallerySubmissionErrors`. */
export function galleryChecklistRows(
  t: Translate,
  value: GalleryFormValue,
  context: { videoUrl: string; options: readonly GalleryScreenshotOption[] },
): Array<{ label: string; filled: boolean }> {
  if (!value.publish_to_gallery) return []

  const optionsById = new Map(context.options.map((option) => [option.id, option]))
  const picked = value.screenshots
  const countOk = picked.length >= GALLERY_MIN_SCREENSHOTS && picked.length <= GALLERY_MAX_SCREENSHOTS
  const imagesOk = picked.every((s) => {
    const option = optionsById.get(s.attachment_id)
    return !option || (Boolean(galleryImageExtension(option.mime_type)) && option.file_size <= GALLERY_MAX_IMAGE_BYTES)
  })
  const summary = value.summary.trim()

  return [
    {
      label: t('projects.gallery.checklist.summary', 'Gallery summary'),
      filled: summary.length > 0 && summary.length <= GALLERY_SUMMARY_MAX_LENGTH,
    },
    { label: t('projects.gallery.checklist.builtOn', 'Built on Open Mercato'), filled: !!value.built_on_open_mercato.trim() },
    { label: t('projects.gallery.checklist.video', 'YouTube or Loom video'), filled: !!parseGalleryVideoUrl(context.videoUrl) },
    {
      label: t('projects.gallery.checklist.screenshots', '2-3 gallery screenshots with descriptions'),
      filled: countOk && imagesOk && picked.every((s) => !!s.alt.trim()),
    },
    {
      label: t('projects.gallery.checklist.poster', 'Poster image'),
      filled: !!value.poster_attachment_id && picked.some((s) => s.attachment_id === value.poster_attachment_id),
    },
    { label: t('projects.gallery.checklist.consent', 'Publication consent'), filled: value.consent_accepted },
  ]
}

const cardClass = 'rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6 space-y-4'
const inputClass =
  'rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2.5 text-sm focus:border-portal-primary focus:ring-1 focus:ring-portal-primary/30 focus:outline-none w-full dark:placeholder:text-slate-500'
const textareaClass = cn(inputClass, 'min-h-[100px] resize-y')
const labelClass = 'text-xs font-bold uppercase tracking-widest text-foreground block mb-1.5'
const checkboxClass = 'mt-1 size-4 rounded border-gray-300 dark:border-white/20 text-portal-primary focus:ring-portal-primary/50'
const helpClass = 'text-xs text-portal-secondary mt-0.5'

function GalleryLink({ siteUrl, children }: { siteUrl: string; children: React.ReactNode }) {
  return (
    <a
      href={siteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-semibold text-portal-primary hover:underline"
    >
      {children}
      <ExternalLink className="size-3.5" />
    </a>
  )
}

/* ---------- editable ---------- */

export function GalleryPublishSection({
  value,
  onChange,
  options,
  videoUrl,
  siteUrl,
}: {
  value: GalleryFormValue
  onChange: (next: GalleryFormValue) => void
  options: readonly GalleryScreenshotOption[]
  videoUrl: string
  siteUrl: string
}) {
  const t = useT()
  const summaryLength = value.summary.trim().length
  const videoOk = !!parseGalleryVideoUrl(videoUrl)
  const pickedIds = value.screenshots.map((s) => s.attachment_id)
  const limitReached = pickedIds.length >= GALLERY_MAX_SCREENSHOTS

  function togglePick(option: GalleryScreenshotOption, checked: boolean) {
    if (checked) {
      if (limitReached || pickedIds.includes(option.id)) return
      const screenshots = [...value.screenshots, { attachment_id: option.id, alt: '' }]
      onChange({ ...value, screenshots, poster_attachment_id: value.poster_attachment_id ?? option.id })
      return
    }
    const screenshots = value.screenshots.filter((s) => s.attachment_id !== option.id)
    const poster = value.poster_attachment_id === option.id ? screenshots[0]?.attachment_id ?? null : value.poster_attachment_id
    onChange({ ...value, screenshots, poster_attachment_id: poster })
  }

  function setAlt(attachmentId: string, alt: string) {
    onChange({
      ...value,
      screenshots: value.screenshots.map((s) => (s.attachment_id === attachmentId ? { ...s, alt } : s)),
    })
  }

  return (
    <div className={cardClass}>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-portal-primary/10 text-portal-primary">
          <Globe className="size-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">{t('projects.gallery.section', 'Open Mercato Project Gallery')}</h3>
          <p className="text-sm text-portal-secondary">
            {t('projects.gallery.intro', 'The gallery is the public showcase of what teams ship on Open Mercato. Opt in and we will publish your project there after the hackathon.')}{' '}
            <GalleryLink siteUrl={siteUrl}>{t('projects.gallery.seeGallery', 'See the gallery')}</GalleryLink>
          </p>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={value.publish_to_gallery}
          onChange={(e) => onChange({ ...value, publish_to_gallery: e.target.checked })}
          className={checkboxClass}
        />
        <div>
          <span className="text-sm font-semibold text-foreground">
            {t('projects.gallery.optIn', 'Publish this project to the Open Mercato Project Gallery')}
          </span>
          <p className={helpClass}>
            {t('projects.gallery.optInHelp', 'Optional. Ticking this adds a few required fields below. Leave it unticked and nothing changes for your submission.')}
          </p>
        </div>
      </label>

      {value.publish_to_gallery && (
        <div className="space-y-5 border-t border-gray-100 dark:border-white/10 pt-5">
          {/* Summary */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-foreground">
                {t('projects.gallery.summary', 'Gallery summary')} *
              </label>
              <span className={cn('text-xs', summaryLength > GALLERY_SUMMARY_MAX_LENGTH ? 'text-red-600' : 'text-portal-secondary')}>
                {summaryLength}/{GALLERY_SUMMARY_MAX_LENGTH}
              </span>
            </div>
            <textarea
              className={textareaClass}
              value={value.summary}
              maxLength={GALLERY_SUMMARY_MAX_LENGTH}
              onChange={(e) => onChange({ ...value, summary: e.target.value })}
              placeholder={t('projects.gallery.summaryPlaceholder', 'One or two sentences. Shown on the gallery card and as the lead of your project page.')}
            />
          </div>

          {/* Built on Open Mercato */}
          <div>
            <label className={labelClass}>{t('projects.gallery.builtOn', 'Built on Open Mercato')} *</label>
            <textarea
              className={textareaClass}
              value={value.built_on_open_mercato}
              onChange={(e) => onChange({ ...value, built_on_open_mercato: e.target.value })}
              placeholder={t('projects.gallery.builtOnPlaceholder', 'What came from the platform (auth, multi-tenancy, module APIs...) and what did your team build on top?')}
            />
          </div>

          {/* Video */}
          <div
            className={cn(
              'rounded-xl border p-3 text-sm',
              videoOk
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
            )}
          >
            {videoOk
              ? t('projects.gallery.videoOk', 'Your video link works for the gallery.')
              : t('projects.gallery.videoRequired', 'The gallery needs a YouTube or Loom link in the Video URL field above. Other hosts (Vimeo, Drive, mp4 files) cannot be embedded.')}
          </div>

          {/* Screenshots */}
          <div>
            <label className={labelClass}>{t('projects.gallery.screenshots', 'Screenshots for the gallery')} *</label>
            <p className={cn(helpClass, 'mb-3')}>
              {t('projects.gallery.screenshotsHelp', 'Pick 2 or 3 of your uploaded screenshots, describe each one, and choose the poster shown on the gallery card. PNG, JPG, WebP or SVG, up to 5 MB each.')}
            </p>
            {options.length === 0 ? (
              <p className="text-sm text-portal-secondary">
                {t('projects.gallery.noScreenshots', 'Upload screenshots in the Media Gallery above first.')}
              </p>
            ) : (
              <div className="space-y-3">
                {options.map((option, idx) => {
                  const picked = value.screenshots.find((s) => s.attachment_id === option.id)
                  const unsupported = !galleryImageExtension(option.mime_type)
                  const tooLarge = option.file_size > GALLERY_MAX_IMAGE_BYTES
                  const disabled = unsupported || tooLarge || (!picked && limitReached)
                  return (
                    <div key={option.id} className="flex flex-col gap-3 sm:flex-row sm:items-start rounded-xl border border-gray-200 dark:border-white/10 p-3">
                      <label className={cn('flex items-center gap-3 shrink-0', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
                        <input
                          type="checkbox"
                          checked={!!picked}
                          disabled={disabled}
                          onChange={(e) => togglePick(option, e.target.checked)}
                          className={cn(checkboxClass, 'mt-0')}
                        />
                        <img
                          src={option.url}
                          alt={`${t('projects.portal.screenshot', 'Screenshot')} ${idx + 1}`}
                          className="size-16 rounded-lg object-cover border border-gray-200 dark:border-white/10"
                        />
                      </label>
                      <div className="flex-1 min-w-0 space-y-2">
                        {unsupported && <p className="text-xs text-amber-700 dark:text-amber-300">{t('projects.gallery.unsupportedImage', 'This format is not supported by the gallery.')}</p>}
                        {tooLarge && <p className="text-xs text-amber-700 dark:text-amber-300">{t('projects.gallery.imageTooLarge', 'Larger than 5 MB, too big for the gallery.')}</p>}
                        {picked && (
                          <>
                            <input
                              type="text"
                              className={inputClass}
                              value={picked.alt}
                              maxLength={300}
                              onChange={(e) => setAlt(option.id, e.target.value)}
                              placeholder={t('projects.gallery.altPlaceholder', 'Describe what this screenshot shows')}
                              aria-label={t('projects.gallery.alt', 'Screenshot description')}
                            />
                            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                              <input
                                type="radio"
                                name="gallery-poster"
                                checked={value.poster_attachment_id === option.id}
                                onChange={() => onChange({ ...value, poster_attachment_id: option.id })}
                                className="size-4 border-gray-300 dark:border-white/20 text-portal-primary focus:ring-portal-primary/50"
                              />
                              {t('projects.gallery.usePoster', 'Use as poster')}
                            </label>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Team names */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={value.show_team_members}
              onChange={(e) => onChange({ ...value, show_team_members: e.target.checked })}
              className={checkboxClass}
            />
            <div>
              <span className="text-sm font-semibold text-foreground">{t('projects.gallery.showTeam', 'Show team member names')}</span>
              <p className={helpClass}>{t('projects.gallery.showTeamHelp', 'Off by default. When off, only your team name appears on the public page.')}</p>
            </div>
          </label>

          {/* Consent */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={value.consent_accepted}
              onChange={(e) => onChange({ ...value, consent_accepted: e.target.checked })}
              className={checkboxClass}
            />
            <span className="text-sm font-semibold text-foreground">
              {t('projects.gallery.consent', 'We have the rights to this content and agree to it being published publicly in the Open Mercato Project Gallery.')} *
            </span>
          </label>
        </div>
      )}
    </div>
  )
}

/* ---------- read-only (after submission) ---------- */

export function GalleryStatusCard({ gallery, siteUrl }: { gallery: GalleryServerState | null | undefined; siteUrl: string }) {
  const t = useT()
  if (!gallery?.publish_to_gallery) return null

  const statusLabel: Record<GalleryServerState['status'], string> = {
    not_requested: t('projects.gallery.status.requested', 'Waiting for organizer review'),
    requested: t('projects.gallery.status.requested', 'Waiting for organizer review'),
    pr_open: t('projects.gallery.status.prOpen', 'In review by the gallery team'),
    published: t('projects.gallery.status.published', 'Live in the gallery'),
    rejected: t('projects.gallery.status.rejected', 'Not accepted'),
  }

  return (
    <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-5">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-portal-secondary">
        {t('projects.gallery.section', 'Open Mercato Project Gallery')}
      </p>
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Globe className="size-4 text-portal-primary" />
        {statusLabel[gallery.status]}
      </div>
      {gallery.status === 'rejected' && gallery.rejected_reason && (
        <p className="mt-2 text-sm text-portal-secondary">{gallery.rejected_reason}</p>
      )}
      <p className="mt-3 text-sm">
        {gallery.status === 'published' && gallery.live_url ? (
          <GalleryLink siteUrl={gallery.live_url}>{t('projects.gallery.viewLive', 'View your project page')}</GalleryLink>
        ) : (
          <GalleryLink siteUrl={siteUrl}>{t('projects.gallery.seeGallery', 'See the gallery')}</GalleryLink>
        )}
      </p>
    </div>
  )
}
