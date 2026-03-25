"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Input } from '@open-mercato/ui/primitives/input'
import { Button } from '@open-mercato/ui/primitives/button'

import {
  Cpu, Brain, Globe, Palette, Shield, Rocket, Heart, Zap, Database, Code,
  Smartphone, Cloud, Lock, Music, Camera, Gamepad2, Leaf, Lightbulb, Microscope, Wifi,
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

type Attachment = { id: string; file_name: string; file_size: number; url: string; mime_type: string }

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
  const router = useRouter()
  const id = params?.id
  const [initial, setInitial] = React.useState<TrackFormValues | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)

  const loadCompetitions = React.useCallback(async (query?: string) => {
    const params: Record<string, string> = { pageSize: '50' }
    if (query) params.name = query
    const data = await fetchCrudList<CompetitionOption>('competitions/competitions', params)
    return (data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))
  }, [])

  // Attachment management state
  const [attachments, setAttachments] = React.useState<Attachment[]>([])
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Load attachments when track loads
  React.useEffect(() => {
    if (!id) return
    let cancelled = false
    async function loadAttachments() {
      const { ok, result } = await apiCall<{ items: Attachment[] }>(
        `/api/attachments?entityId=tracks:track&recordId=${id}`,
      )
      if (!cancelled && ok && result?.items) setAttachments(result.items)
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
      const { ok, result } = await apiCall<{ item: Attachment }>('/api/attachments', {
        method: 'POST',
        body: formData,
      })
      if (ok && result?.item) {
        setAttachments((prev) => [...prev, result.item])
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveAttachment(attachmentId: string) {
    await apiCall(`/api/attachments?id=${attachmentId}`, { method: 'DELETE' })
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const fields = React.useMemo<CrudField[]>(() => [
    { id: 'competition_id', label: t('tracks.fields.competition', 'Competition'), type: 'combobox', required: true, loadOptions: loadCompetitions },
    { id: 'name', label: t('tracks.fields.name', 'Name'), type: 'text', required: true },
    { id: 'short_description', label: t('tracks.fields.shortDescription', 'Short Description'), type: 'text', placeholder: 'A brief tagline for this track' },
    { id: 'description', label: t('tracks.fields.description', 'Full Description'), type: 'textarea' },
    {
      id: 'attachment_ids', label: t('tracks.fields.attachments', 'Attachments'), type: 'custom',
      component: () => (
        <div className="space-y-3">
          {attachments.length > 0 && (
            <ul className="divide-y rounded-md border">
              {attachments.map((att) => (
                <li key={att.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="truncate text-sm">{att.file_name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">({formatFileSize(att.file_size)})</span>
                  </div>
                  <button type="button" onClick={() => handleRemoveAttachment(att.id)} className="shrink-0 text-xs text-red-500 hover:text-red-700">Remove</button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" onChange={handleUpload} className="hidden" />
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? 'Uploading...' : 'Upload File'}
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
  ], [t, loadCompetitions])

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
        if (!cancelled) {
          setInitial({
            id: String(item.id),
            competition_id: String(item.competition_id ?? ''),
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
