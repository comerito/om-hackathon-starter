"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFieldOption, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { Input } from '@open-mercato/ui/primitives/input'
import { Button } from '@open-mercato/ui/primitives/button'
import {
  attachmentDownloadUrl,
  attachmentTypeLabel,
  formatAttachmentSize,
  normalizeTrackAttachment,
  normalizeTrackAttachments,
  type TrackAttachment,
} from '../../../../lib/attachments'

import {
  Cpu, Brain, Globe, Palette, Shield, Rocket, Heart, Zap, Database, Code,
  Smartphone, Cloud, Lock, Music, Camera, Gamepad2, Leaf, Lightbulb, Microscope, Wifi,
  Download, FileText,
  type LucideIcon,
} from 'lucide-react'

const ICON_OPTIONS: Array<{ value: string; name: string; Icon: LucideIcon }> = [
  { value: 'lucide:cpu', name: 'cpu', Icon: Cpu },
  { value: 'lucide:brain', name: 'brain', Icon: Brain },
  { value: 'lucide:globe', name: 'globe', Icon: Globe },
  { value: 'lucide:palette', name: 'palette', Icon: Palette },
  { value: 'lucide:shield', name: 'shield', Icon: Shield },
  { value: 'lucide:rocket', name: 'rocket', Icon: Rocket },
  { value: 'lucide:heart', name: 'heart', Icon: Heart },
  { value: 'lucide:zap', name: 'zap', Icon: Zap },
  { value: 'lucide:database', name: 'database', Icon: Database },
  { value: 'lucide:code', name: 'code', Icon: Code },
  { value: 'lucide:smartphone', name: 'smartphone', Icon: Smartphone },
  { value: 'lucide:cloud', name: 'cloud', Icon: Cloud },
  { value: 'lucide:lock', name: 'lock', Icon: Lock },
  { value: 'lucide:music', name: 'music', Icon: Music },
  { value: 'lucide:camera', name: 'camera', Icon: Camera },
  { value: 'lucide:gamepad-2', name: 'gamepad-2', Icon: Gamepad2 },
  { value: 'lucide:leaf', name: 'leaf', Icon: Leaf },
  { value: 'lucide:lightbulb', name: 'lightbulb', Icon: Lightbulb },
  { value: 'lucide:microscope', name: 'microscope', Icon: Microscope },
  { value: 'lucide:wifi', name: 'wifi', Icon: Wifi },
]

type CompetitionOption = { id: string; name: string }

type TrackFormValues = {
  id: string
  competition_id: string
  name: string
  short_description: string
  description: string
  attachment_ids: string[]
  color: string
  icon_url: string
  category: string
  badge: string
  max_teams: number | null
  order: number
}

export default function EditTrackPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<TrackFormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)
  // Display label for the track's currently linked competition. The track API returns
  // only `competition_id`, and `loadCompetitions` is paginated, so the picker cannot be
  // relied on to know the label of a pre-selected id on its own.
  const [competitionSeedOptions, setCompetitionSeedOptions] = React.useState<CrudFieldOption[]>([])

  const loadCompetitions = React.useCallback(async (query?: string) => {
    const params: Record<string, string> = { pageSize: '50' }
    if (query) params.name = query
    const data = await fetchCrudList<CompetitionOption>('competitions/competitions', params)
    return (data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))
  }, [])

  // Attachment management state
  const [attachments, setAttachments] = React.useState<TrackAttachment[]>([])
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Load attachments when track loads
  React.useEffect(() => {
    if (!id) return
    const trackId = id
    let cancelled = false
    async function loadAttachments() {
      const { ok, result } = await apiCall<{ items?: unknown }>(
        `/api/attachments?entityId=tracks:track&recordId=${encodeURIComponent(trackId)}`,
      )
      if (!cancelled && ok) setAttachments(normalizeTrackAttachments(result?.items))
    }
    loadAttachments()
    return () => { cancelled = true }
  }, [id])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set('entityId', 'tracks:track')
      formData.set('recordId', id)
      formData.set('fieldKey', 'attachments')
      formData.set('file', file)
      const { ok, result } = await apiCall<{ item?: unknown }>('/api/attachments', {
        method: 'POST',
        body: formData,
      })
      const uploaded = ok ? normalizeTrackAttachment(result?.item) : null
      if (uploaded) {
        // The upload response carries no MIME type or timestamp; fill in what the browser knows.
        // Newest first, matching the order the list API returns after a reload.
        setAttachments((prev) => [{
          ...uploaded,
          mimeType: uploaded.mimeType ?? (file.type || null),
          createdAt: uploaded.createdAt ?? new Date().toISOString(),
        }, ...prev])
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveAttachment(attachmentId: string) {
    const { ok } = await apiCall(`/api/attachments?id=${encodeURIComponent(attachmentId)}`, { method: 'DELETE' })
    if (ok) setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
  }

  function describeAttachment(att: TrackAttachment): string {
    const createdAt = att.createdAt ? new Date(att.createdAt) : null
    return [
      formatAttachmentSize(att.fileSize),
      attachmentTypeLabel(att),
      createdAt && !Number.isNaN(createdAt.getTime())
        ? t('tracks.attachments.uploadedAt', 'Uploaded {date}', { date: createdAt.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) })
        : null,
    ].filter(Boolean).join(' · ')
  }

  // The attachments field renders page state, so the field list is rebuilt when that state changes.
  const fields = React.useMemo<CrudField[]>(() => [
    {
      id: 'competition_id',
      label: t('tracks.fields.competition', 'Competition'),
      type: 'combobox',
      required: true,
      loadOptions: loadCompetitions,
      // Hydrate the option map with the linked competition so the picker renders its
      // name instead of the raw uuid (or nothing) before the user interacts with it.
      seedOptions: competitionSeedOptions,
    },
    { id: 'name', label: t('tracks.fields.name', 'Name'), type: 'text', required: true },
    { id: 'short_description', label: t('tracks.fields.shortDescription', 'Short Description'), type: 'text', placeholder: 'A brief tagline for this track' },
    {
      id: 'description',
      label: t('tracks.fields.description', 'Full Description'),
      description: t('tracks.fields.descriptionHelp', 'Supports rich formatting and per-locale translations.'),
      type: 'richtext',
      editor: 'uiw',
    },
    {
      id: 'attachment_ids', label: t('tracks.fields.attachments', 'Attachments'), type: 'custom',
      component: () => (
        <div className="space-y-3">
          {attachments.length > 0 && (
            <ul className="divide-y rounded-md border">
              {attachments.map((att) => {
                const fileName = att.fileName || t('tracks.attachments.unnamed', 'Unnamed file')
                const details = describeAttachment(att)
                // The section sits in the narrow side column, so the name and details wrap instead
                // of truncating, and the actions get their own line.
                return (
                  <li key={att.id} className="flex items-start gap-2 px-3 py-2">
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium [overflow-wrap:anywhere]">{fileName}</p>
                      {details ? <p className="text-xs text-muted-foreground">{details}</p> : null}
                      <div className="-ml-1.5 mt-1 flex flex-wrap items-center gap-1">
                        <Button asChild variant="ghost" size="2xs">
                          <a
                            href={attachmentDownloadUrl(att.id)}
                            download={att.fileName || undefined}
                            aria-label={t('tracks.attachments.downloadFile', 'Download {name}', { name: fileName })}
                          >
                            <Download aria-hidden />
                            {t('tracks.attachments.download', 'Download')}
                          </a>
                        </Button>
                        <Button
                          type="button"
                          variant="destructive-ghost"
                          size="2xs"
                          aria-label={t('tracks.attachments.removeFile', 'Remove {name}', { name: fileName })}
                          onClick={() => handleRemoveAttachment(att.id)}
                        >
                          {t('tracks.attachments.remove', 'Remove')}
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" onChange={handleUpload} className="hidden" />
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? t('tracks.attachments.uploading', 'Uploading...') : t('tracks.attachments.upload', 'Upload File')}
            </Button>
          </div>
        </div>
      ),
    },
    {
      id: 'color', label: t('tracks.fields.color', 'Color'), type: 'custom',
      component: ({ value, setValue }) => (
        <div className="flex items-center gap-3">
          <input type="color" value={String(value || '#6366f1')} onChange={(e) => setValue(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-input bg-background p-1" />
          <Input value={String(value || '#6366f1')}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
            placeholder="#6366f1" className="max-w-[140px] font-mono text-sm" />
          <div className="h-6 w-6 rounded-full border" style={{ backgroundColor: String(value || '#6366f1') }} />
        </div>
      ),
    },
    {
      id: 'icon_url', label: t('tracks.fields.iconUrl', 'Icon'), type: 'custom',
      component: ({ value, setValue }) => (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {ICON_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setValue(opt.value)} title={opt.name}
                className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
                  value === opt.value ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30' : 'border-input text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}>
                <opt.Icon className="size-4" />
              </button>
            ))}
          </div>
          <Input value={String(value || '')}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
            placeholder="lucide:icon-name or URL" className="max-w-[300px] text-sm" />
        </div>
      ),
    },
    { id: 'category', label: t('tracks.fields.category', 'Category'), type: 'text' },
    { id: 'badge', label: t('tracks.fields.badge', 'Badge'), type: 'select', options: [
      { value: '', label: 'None' },
      { value: 'new', label: 'NEW' },
      { value: 'hot', label: 'HOT' },
      { value: 'stability', label: 'STABILITY' },
    ]},
    { id: 'max_teams', label: t('tracks.fields.maxTeams', 'Max Teams'), type: 'number' },
    { id: 'order', label: t('tracks.fields.order', 'Order'), type: 'number' },
  ], [t, locale, loadCompetitions, competitionSeedOptions, attachments, uploading])

  const groups = React.useMemo<CrudFormGroup[]>(() => [
    { id: 'general', title: t('tracks.groups.general', 'General'), column: 1, fields: ['competition_id', 'name', 'short_description', 'description', 'category', 'badge'] },
    { id: 'appearance', title: t('tracks.groups.appearance', 'Appearance'), column: 2, fields: ['color', 'icon_url'] },
    { id: 'attachments', title: t('tracks.groups.attachments', 'Attachments'), column: 2, fields: ['attachment_ids'] },
    { id: 'settings', title: t('tracks.groups.settings', 'Settings'), column: 1, fields: ['max_teams', 'order'] },
  ], [t])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setLoading(true)
      setErr(null)
      try {
        const data = await fetchCrudList<Record<string, unknown>>('tracks/tracks', { id, pageSize: '1' })
        const item = data?.items?.[0]
        if (!item) throw new Error('Track not found')
        const competitionId = String(item.competition_id ?? '')
        if (competitionId) {
          // Best-effort: a missing label only degrades the picker to the raw id,
          // it must never keep the form from loading.
          try {
            const competitions = await fetchCrudList<CompetitionOption>('competitions/competitions', { id: competitionId, pageSize: '1' })
            const competition = competitions?.items?.[0]
            if (!cancelled && competition?.id && competition?.name) {
              setCompetitionSeedOptions([{ value: String(competition.id), label: String(competition.name) }])
            }
          } catch {
            // ignore — combobox falls back to loadOptions
          }
        }
        if (!cancelled) {
          setInitial({
            id: String(item.id),
            competition_id: competitionId,
            name: String(item.name ?? ''),
            short_description: String(item.short_description ?? ''),
            description: String(item.description ?? ''),
            attachment_ids: Array.isArray(item.attachment_ids) ? item.attachment_ids as string[] : [],
            color: String(item.color ?? '#6366f1'),
            icon_url: String(item.icon_url ?? ''),
            category: String(item.category ?? ''),
            badge: String(item.badge ?? ''),
            max_teams: item.max_teams != null ? Number(item.max_teams) : null,
            order: Number(item.order ?? 0),
          })
        }
      } catch (error: unknown) {
        if (!cancelled) setErr(error instanceof Error ? error.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  const fallback = React.useMemo<TrackFormValues>(() => ({
    id: id ?? '', competition_id: '', name: '', short_description: '', description: '',
    attachment_ids: [], color: '#6366f1', icon_url: '', category: '', badge: '', max_teams: null, order: 0,
  }), [id])

  if (!id) return null

  return (
    <Page>
      <PageBody>
        {err ? (
          <div className="text-red-600">{err}</div>
        ) : (
          <CrudForm<TrackFormValues>
            title={t('tracks.edit.title', 'Edit Track')}
            backHref="/backend/tracks"
            entityId="tracks:track"
            fields={fields}
            groups={groups}
            initialValues={initial ?? fallback}
            // "Competition" is the first field, so CrudForm would autofocus it on mount.
            // ComboboxInput only mirrors its `value` into the visible text while the input
            // is NOT focused, so focusing it on its very first render leaves the control
            // showing the empty "Type to search..." placeholder forever, even though
            // competition_id is set (#90). Suppressing the mount-time autofocus lets the
            // control render its selected competition.
            disableInitialFocus
            submitLabel={t('tracks.edit.submit', 'Save')}
            cancelHref="/backend/tracks"
            successRedirect={`/backend/tracks?flash=${encodeURIComponent(t('tracks.flash.saved', 'Track saved'))}&type=success`}
            isLoading={loading}
            loadingMessage={t('tracks.edit.loading', 'Loading track...')}
            onSubmit={async (vals) => { await updateCrud('tracks/tracks', { ...vals, attachment_ids: attachments.map((a) => a.id) }) }}
            onDelete={async () => {
              if (!id) return
              try {
                await deleteCrud('tracks/tracks', String(id))
                pushWithFlash(router, '/backend/tracks', t('tracks.flash.deleted', 'Track deleted'), 'success')
              } catch (error) {
                setErr(error instanceof Error ? error.message : 'Delete failed')
              }
            }}
          />
        )}
      </PageBody>
    </Page>
  )
}
